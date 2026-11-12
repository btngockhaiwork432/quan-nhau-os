#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
quannhau_print_bridge.py - Cau noi in nhiet K80 tu dong (Ho tro ca cong USB Windows + Wi-Fi / LAN TCP 9100)
Danh cho he thong Quan Nhau OS (https://munbao.com).

Co che hoat dong:
1. Chay ngam tren chiếc Laptop tai quan (ket noi chung Wi-Fi quan va cam day USB voi May in Thu ngan).
2. Moi 1.5 giay hoi may chu https://munbao.com/api/print-queue xem co phieu Bep / Ho ca / Tam tinh / Hoa don moi khong.
3. Ho tro dong thoi 2 kieu ket noi may in tren cung 1 Laptop:
   - Kieu 1 (May in cam day USB truc tiep vao Laptop): Nhap chu "USB" (hoac "USB:Ten_May_In") vao o IP tren web.
     Tu dong day lenh ESC/POS cat giay + ma QR thang qua cong USB Windows (winspool.drv RAW) khong can hop thoai Ctrl+P!
   - Kieu 2 (May in bat song Wi-Fi hoac cam day LAN): Nhap dia chi IP (VD: 192.168.1.201, cong 9100) vao o IP tren web.
     Tu dong day lenh ESC/POS + coi bao "Bip bip" + cat giay qua mang Wi-Fi/LAN trong < 2 giay!
4. Neu may in chinh mat ket noi, tu dong chuyen sang may in du phong (VD: May Bep hong -> tu in ra May Thu ngan USB).
"""

import argparse
import concurrent.futures
import ctypes
from ctypes import wintypes
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

DEFAULT_SERVER = os.environ.get("QUANNHAU_SERVER_URL", "https://munbao.com")
LINE_WIDTH = 48  # Kho giay K80 tieu chuan: 48 ky tu Font A
AUTO_LAN_TOKENS = {"AUTO", "WIFI", "LAN", "AUTO_LAN"}

_LAST_SCAN_AT: Dict[int, float] = {}
_LAST_SCAN_HOSTS: Dict[int, List[str]] = {}
_BRIDGE_CACHE: Optional[Dict[str, Any]] = None


def strip_vn(text: str) -> str:
    """Chuyen tieng Viet co dau sang khong dau ro net (tuong thich 100% may in nhiet Xprinter/Zywell/Epson)."""
    if not text:
        return ""
    s = str(text).replace("Đ", "D").replace("đ", "d")
    s = s.replace("–", "-").replace("—", "-").replace("·", "-").replace("→", "->")
    nfd = unicodedata.normalize("NFD", s)
    out = "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")
    return out.encode("ascii", "ignore").decode("ascii")


def safe_print(msg: str) -> None:
    """In log an toan tren moi Windows console (tranh UnicodeEncodeError khi stdout la cp1252/cp437)."""
    text = str(msg)
    try:
        print(text)
    except UnicodeEncodeError:
        try:
            print(strip_vn(text))
        except Exception:
            print(text.encode("ascii", "replace").decode("ascii"))


def encode_line(text: str, use_utf8: bool = False) -> bytes:
    if use_utf8:
        return (str(text or "") + "\n").encode("utf-8", errors="replace")
    return (strip_vn(text) + "\n").encode("ascii", errors="ignore")


def format_two_cols(left: str, right: str, width: int = LINE_WIDTH, use_utf8: bool = False) -> str:
    l_txt = str(left or "") if use_utf8 else strip_vn(left)
    r_txt = str(right or "") if use_utf8 else strip_vn(right)
    if not r_txt:
        return l_txt
    space = width - len(l_txt) - len(r_txt)
    if space >= 1:
        return l_txt + (" " * space) + r_txt
    max_left = max(10, width - len(r_txt) - 2)
    if len(l_txt) > max_left:
        l_txt = l_txt[: max_left - 2] + ".."
    space = max(1, width - len(l_txt) - len(r_txt))
    return l_txt + (" " * space) + r_txt


def build_escpos_qr(qr_data: str, module_size: int = 6) -> bytes:
    """Sinh lenh in ma QR goc chuan ESC/POS (GS ( k - Model 2) ho tro Xprinter/Zywell/Epson K80."""
    if not qr_data:
        return b""
    raw = str(qr_data).encode("utf-8")
    store_len = len(raw) + 3
    pl = store_len & 0xFF
    ph = (store_len >> 8) & 0xFF
    size_b = bytes([max(3, min(8, int(module_size)))])
    out = bytearray()
    # 1. Chon QR Model 2
    out.extend(b"\x1d\x28\x6b\x04\x00\x31\x41\x32\x00")
    # 2. Kich thuoc o vuong QR
    out.extend(b"\x1d\x28\x6b\x03\x00\x31\x43" + size_b)
    # 3. Muc sua loi M (49 = 0x31)
    out.extend(b"\x1d\x28\x6b\x03\x00\x31\x45\x31")
    # 4. Nap du lieu QR vao bo nho may in
    out.extend(bytes([0x1D, 0x28, 0x6B, pl, ph, 0x31, 0x50, 0x30]) + raw)
    # 5. In ma QR ra giay
    out.extend(b"\x1d\x28\x6b\x03\x00\x31\x51\x30")
    return bytes(out)


def build_escpos_payload(job: Dict[str, Any], use_utf8: bool = False, beep: bool = True) -> bytes:
    doc = job.get("doc") or {}
    kind = str(job.get("kind") or doc.get("kind") or "kitchen")

    ESC = b"\x1b"
    GS = b"\x1d"

    INIT = ESC + b"@"
    ALIGN_LEFT = ESC + b"a\x00"
    ALIGN_CENTER = ESC + b"a\x01"
    BOLD_ON = ESC + b"E\x01"
    BOLD_OFF = ESC + b"E\x00"
    SIZE_NORMAL = GS + b"!\x00"
    SIZE_DOUBLE_H = GS + b"!\x01"
    SIZE_HUGE = GS + b"!\x11"  # Gap doi chieu ngang + chieu cao cho ma ban o Bep
    CUT_PARTIAL = GS + b"V\x42\x10"
    BUZZER = ESC + b"B\x03\x02"  # Keu 3 tieng bip ngan bao Bep co mon moi

    buf = bytearray()
    buf.extend(INIT)
    if use_utf8:
        buf.extend(ESC + b"t\x00")

    if beep and kind in ("kitchen", "tag"):
        buf.extend(BUZZER)

    sep_dash = "-" * LINE_WIDTH
    sep_eq = "=" * LINE_WIDTH

    # Header quan (neu co)
    headers = doc.get("header") or []
    if headers:
        buf.extend(ALIGN_CENTER)
        for idx, h in enumerate(headers):
            if idx == 0:
                buf.extend(BOLD_ON + SIZE_DOUBLE_H)
                buf.extend(encode_line(h, use_utf8))
                buf.extend(SIZE_NORMAL + BOLD_OFF)
            else:
                buf.extend(encode_line(h, use_utf8))
        buf.extend(encode_line(sep_dash, use_utf8))

    # Tieu de phieu
    title = doc.get("title") or job.get("title") or "PHIEU IN"
    buf.extend(ALIGN_CENTER + BOLD_ON + SIZE_DOUBLE_H)
    buf.extend(encode_line(title, use_utf8))
    buf.extend(SIZE_NORMAL + BOLD_OFF)

    # So ban to ro cho Bep / Ho ca
    big_code = doc.get("big")
    if big_code:
        buf.extend(ALIGN_CENTER + BOLD_ON + SIZE_HUGE)
        buf.extend(encode_line(f"BAN: {big_code}", use_utf8))
        buf.extend(SIZE_NORMAL + BOLD_OFF)

    buf.extend(ALIGN_LEFT)
    buf.extend(encode_line(sep_eq, use_utf8))

    # Meta (Ban, Gio vao, Phuc vu...)
    for m in doc.get("meta") or []:
        buf.extend(encode_line(format_two_cols(m.get("l", ""), m.get("r", ""), LINE_WIDTH, use_utf8), use_utf8))
    if doc.get("meta"):
        buf.extend(encode_line(sep_dash, use_utf8))

    # Danh sach mon / dong noi dung
    for r in doc.get("rows") or []:
        is_big = bool(r.get("big"))
        is_bold = bool(r.get("bold")) or is_big
        if is_bold:
            buf.extend(BOLD_ON)
        if is_big:
            buf.extend(SIZE_DOUBLE_H)
        if "r" in r and r.get("r") is not None:
            w = LINE_WIDTH
            buf.extend(encode_line(format_two_cols(r.get("l", ""), r.get("r", ""), w, use_utf8), use_utf8))
        else:
            buf.extend(encode_line(r.get("l", ""), use_utf8))
        if is_big:
            buf.extend(SIZE_NORMAL)
        if is_bold:
            buf.extend(BOLD_OFF)
        if r.get("note"):
            buf.extend(encode_line("  * " + str(r.get("note")), use_utf8))

    # Tong cong (bill tam tinh / hoa don)
    if doc.get("sumRows"):
        buf.extend(encode_line(sep_dash, use_utf8))
        for sr in doc.get("sumRows") or []:
            is_bold = bool(sr.get("bold") or sr.get("big"))
            if is_bold:
                buf.extend(BOLD_ON)
            buf.extend(encode_line(format_two_cols(sr.get("l", ""), sr.get("r", ""), LINE_WIDTH, use_utf8), use_utf8))
            if is_bold:
                buf.extend(BOLD_OFF)

    # Ghi chu QR + Ma VietQR ESC/POS / VAT / Footer
    if doc.get("qrLabel") or doc.get("qr"):
        buf.extend(encode_line(sep_dash, use_utf8))
        buf.extend(ALIGN_CENTER)
        if doc.get("qrLabel"):
            buf.extend(encode_line(doc.get("qrLabel"), use_utf8))
        if doc.get("qr"):
            buf.extend(b"\n")
            buf.extend(build_escpos_qr(str(doc.get("qr")), module_size=6))
            buf.extend(b"\n")
        buf.extend(ALIGN_LEFT)

    if doc.get("footer"):
        buf.extend(encode_line(sep_dash, use_utf8))
        buf.extend(ALIGN_CENTER)
        for f_line in doc.get("footer") or []:
            buf.extend(encode_line(f_line, use_utf8))
        buf.extend(ALIGN_LEFT)

    ts_str = datetime.now().strftime("%H:%M:%S %d/%m/%Y")
    printer_lbl = job.get("printerName") or job.get("printerId") or ""
    buf.extend(ALIGN_CENTER)
    buf.extend(encode_line(f"[{printer_lbl} - {ts_str}]", use_utf8))
    buf.extend(b"\n\n")
    buf.extend(CUT_PARTIAL)
    return bytes(buf)


# ==============================================================================
# HO TRO IN QUA CONG USB WINDOWS (WINSPOOL.DRV RAW) VA WIFI/LAN (TCP 9100)
# ==============================================================================

def list_windows_printers() -> List[Tuple[str, str]]:
    """Tra ve danh sach [(ten_may_in, cong_ket_noi)] da cai tren Windows."""
    if os.name != "nt":
        return []
    out: List[Tuple[str, str]] = []
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows NT\CurrentVersion\Devices") as key:
            idx = 0
            while True:
                try:
                    name, val, _ = winreg.EnumValue(key, idx)
                    port = str(val).split(",")[-1].strip() if val else ""
                    out.append((str(name), port))
                    idx += 1
                except OSError:
                    break
    except Exception:
        pass
    return out


def resolve_windows_usb_printer(spec: str) -> Optional[str]:
    """
    Tim ten may in Windows tu chuoi cau hinh:
    - "USB" hoac "USB:auto": Tu dong chon may in nhiet K80/Xprinter/POS hoac may in cam cong USB00x
    - "USB:<ten may in>": Tim may in khớp tên được chỉ định
    """
    printers = list_windows_printers()
    if not printers:
        return None
    raw = str(spec or "").strip()
    hint = ""
    if ":" in raw:
        hint = raw.split(":", 1)[1].strip().lower()

    VIRTUAL_SKIP = ("microsoft print to pdf", "microsoft xps", "onenote", "fax", "anydesk", "teamviewer")

    if hint and hint != "auto":
        for name, _port in printers:
            if name.lower() == hint:
                return name
        for name, _port in printers:
            if hint in name.lower():
                return name

    # Uu tien 1: May in co ten nhiet K80 / POS / Xprinter / Zywell
    THERMAL_KEYS = ("80", "xp-", "pos", "xprinter", "zywell", "k80", "receipt", "bill", "thermal", "gp-", "gprinter", "epson")
    for name, port in printers:
        low = name.lower()
        if any(v in low for v in VIRTUAL_SKIP):
            continue
        if any(k in low for k in THERMAL_KEYS):
            return name

    # Uu tien 2: May in dang cam o cong USB001, USB002...
    for name, port in printers:
        low = name.lower()
        if any(v in low for v in VIRTUAL_SKIP):
            continue
        if port.upper().startswith("USB"):
            return name

    # Uu tien 3: May in bat ky khong phai may in ao PDF/XPS
    for name, _port in printers:
        low = name.lower()
        if not any(v in low for v in VIRTUAL_SKIP):
            return name
    return None


class _DOC_INFO_1W(ctypes.Structure):
    _fields_ = [
        ("pDocName", wintypes.LPWSTR),
        ("pOutputFile", wintypes.LPWSTR),
        ("pDatatype", wintypes.LPWSTR),
    ]


def send_windows_usb_raw(printer_name: str, data: bytes) -> None:
    """Day luong byte ESC/POS RAW truc tiep xuong may in USB tren Windows qua winspool.drv."""
    if os.name != "nt":
        raise RuntimeError("Chế độ in USB trực tiếp chỉ hỗ trợ trên Windows.")
    winspool = ctypes.WinDLL("winspool.drv", use_last_error=True)

    OpenPrinterW = winspool.OpenPrinterW
    OpenPrinterW.argtypes = [wintypes.LPWSTR, ctypes.POINTER(wintypes.HANDLE), wintypes.LPVOID]
    OpenPrinterW.restype = wintypes.BOOL

    StartDocPrinterW = winspool.StartDocPrinterW
    StartDocPrinterW.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(_DOC_INFO_1W)]
    StartDocPrinterW.restype = wintypes.DWORD

    StartPagePrinter = winspool.StartPagePrinter
    StartPagePrinter.argtypes = [wintypes.HANDLE]
    StartPagePrinter.restype = wintypes.BOOL

    WritePrinter = winspool.WritePrinter
    WritePrinter.argtypes = [wintypes.HANDLE, wintypes.LPVOID, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    WritePrinter.restype = wintypes.BOOL

    EndPagePrinter = winspool.EndPagePrinter
    EndPagePrinter.argtypes = [wintypes.HANDLE]
    EndPagePrinter.restype = wintypes.BOOL

    EndDocPrinter = winspool.EndDocPrinter
    EndDocPrinter.argtypes = [wintypes.HANDLE]
    EndDocPrinter.restype = wintypes.BOOL

    ClosePrinter = winspool.ClosePrinter
    ClosePrinter.argtypes = [wintypes.HANDLE]
    ClosePrinter.restype = wintypes.BOOL

    h_printer = wintypes.HANDLE()
    if not OpenPrinterW(printer_name, ctypes.byref(h_printer), None):
        err = ctypes.get_last_error()
        raise OSError(f"Không mở được máy in Windows '{printer_name}' (Mã lỗi {err})")
    try:
        doc_info = _DOC_INFO_1W("QuanNhauOS_K80_Receipt", None, "RAW")
        job_id = StartDocPrinterW(h_printer, 1, ctypes.byref(doc_info))
        if not job_id:
            err = ctypes.get_last_error()
            raise OSError(f"StartDocPrinterW thất bại trên '{printer_name}' (Mã lỗi {err})")
        try:
            StartPagePrinter(h_printer)
            written = wintypes.DWORD(0)
            buf = ctypes.create_string_buffer(data, len(data))
            if not WritePrinter(h_printer, buf, len(data), ctypes.byref(written)):
                err = ctypes.get_last_error()
                raise OSError(f"WritePrinter thất bại trên '{printer_name}' (Mã lỗi {err})")
            EndPagePrinter(h_printer)
        finally:
            EndDocPrinter(h_printer)
    finally:
        ClosePrinter(h_printer)


def send_tcp_9100(ip: str, port: int, data: bytes, timeout: float = 3.0) -> None:
    with socket.create_connection((ip, int(port or 9100)), timeout=timeout) as sock:
        sock.sendall(data)


def is_usb_target(ip_str: str) -> bool:
    s = str(ip_str or "").strip().upper()
    return s == "USB" or s.startswith("USB:")


def is_auto_lan_target(ip_str: str) -> bool:
    return str(ip_str or "").strip().upper() in AUTO_LAN_TOKENS


def _cache_file_candidates() -> List[str]:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return [
        os.path.join(script_dir, "printer_cache.json"),
        os.path.join(tempfile.gettempdir(), "quannhau_printer_cache.json"),
    ]


def load_bridge_cache() -> Dict[str, Any]:
    global _BRIDGE_CACHE
    if _BRIDGE_CACHE is not None:
        return _BRIDGE_CACHE
    for path in _cache_file_candidates():
        try:
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    data.setdefault("printers", {})
                    data.setdefault("printed_ids", [])
                    _BRIDGE_CACHE = data
                    return _BRIDGE_CACHE
        except Exception:
            continue
    _BRIDGE_CACHE = {"printers": {}, "printed_ids": []}
    return _BRIDGE_CACHE


def save_bridge_cache() -> None:
    cache = load_bridge_cache()
    if len(cache.get("printed_ids") or []) > 250:
        cache["printed_ids"] = cache["printed_ids"][-250:]
    for path in _cache_file_candidates():
        try:
            tmp_path = path + ".tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)
            os.replace(tmp_path, path)
            return
        except Exception:
            continue


def mark_printed_locally(job_id: str) -> None:
    if not job_id:
        return
    cache = load_bridge_cache()
    ids: List[str] = cache.setdefault("printed_ids", [])
    if job_id not in ids:
        ids.append(job_id)
        if len(ids) > 250:
            del ids[:-250]
        save_bridge_cache()


def was_printed_locally(job_id: str) -> bool:
    if not job_id:
        return False
    cache = load_bridge_cache()
    return job_id in (cache.get("printed_ids") or [])


def get_arp_table() -> Dict[str, str]:
    """Doc bang ARP cua he dieu hanh de anh xa IP -> dia chi MAC phan cung may in."""
    mapping: Dict[str, str] = {}
    try:
        kwargs: Dict[str, Any] = {"capture_output": True, "text": True, "timeout": 3}
        if os.name == "nt":
            kwargs["creationflags"] = 0x08000000  # CREATE_NO_WINDOW
        res = subprocess.run(["arp", "-a"], **kwargs)
        out = res.stdout or ""
        for ip, mac in re.findall(r"(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F]{2}(?:[-:][0-9a-fA-F]{2}){5})", out):
            norm_mac = mac.replace(":", "-").lower()
            if norm_mac not in ("ff-ff-ff-ff-ff-ff", "00-00-00-00-00-00"):
                mapping[ip] = norm_mac
    except Exception:
        pass
    return mapping


def remember_printer_ip_mac(printer_id: str, configured_ip: str, working_ip: str, port: int = 9100) -> Optional[str]:
    """Luu dia chi MAC & IP hoat dong gan nhat cua may in de tu tim lai neu router doi IP."""
    if not printer_id or not working_ip or is_usb_target(working_ip):
        return None
    arp = get_arp_table()
    mac = arp.get(working_ip)
    cache = load_bridge_cache()
    pr_map = cache.setdefault("printers", {})
    prev = pr_map.get(printer_id) or {}
    entry = {
        "configured_ip": configured_ip,
        "resolved_ip": working_ip,
        "port": int(port or 9100),
        "mac": mac or prev.get("mac") or "",
        "updated_at": int(time.time()),
    }
    if pr_map.get(printer_id) != entry:
        pr_map[printer_id] = entry
        save_bridge_cache()
    return entry.get("mac") or None


def send_to_target(target_ip: str, target_port: int, raw: bytes) -> str:
    """Gui du lieu ESC/POS toi dich (USB Windows hoac IP Wi-Fi/LAN) va tra ve mo ta ket noi."""
    if is_usb_target(target_ip):
        pr_name = resolve_windows_usb_printer(target_ip)
        if not pr_name:
            raise RuntimeError(
                "Chưa tìm thấy driver máy in hóa đơn USB trên Laptop. "
                "Hãy cắm dây USB máy in vào Laptop và cài Driver Xprinter/POS-80 trước!"
            )
        send_windows_usb_raw(pr_name, raw)
        return f"Cổng USB Windows ({pr_name})"
    send_tcp_9100(target_ip, target_port, raw)
    return f"Wi-Fi/LAN ({target_ip}:{target_port})"


def get_local_lan_ips() -> List[str]:
    """Lay danh sach IP mang noi bo that cua Laptop (uu tien 192.168.x.x, loc VPN/ao)."""
    raw_ips: List[str] = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            raw_ips.append(s.getsockname()[0])
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            raw_ips.append(info[4][0])
    except Exception:
        pass

    clean: List[str] = []
    for ip in raw_ips:
        if not ip or ip.startswith("127.") or ip.startswith("169.254.") or ip.startswith("192.0."):
            continue
        if ip not in clean:
            clean.append(ip)

    def _prio(ip: str) -> int:
        if ip.startswith("192.168."):
            return 0
        if ip.startswith("10."):
            return 1
        if ip.startswith("172."):
            return 2
        return 3

    clean.sort(key=_prio)
    return clean or ["127.0.0.1"]


def get_local_lan_ip() -> str:
    return get_local_lan_ips()[0]


def scan_network_printers(port: int = 9100, timeout: float = 0.35) -> List[str]:
    """Quet nhanh toan bo dai mang Wi-Fi/LAN hien tai cua Laptop de tim cac may in mo cong 9100."""
    lan_ips = get_local_lan_ips()
    candidates: List[str] = []
    seen_subnets: Set[str] = set()
    skip_hosts: Set[str] = set(lan_ips)
    for local_ip in lan_ips:
        parts = local_ip.split(".")
        if len(parts) != 4 or local_ip.startswith("127."):
            continue
        prefix = ".".join(parts[:3])
        if prefix in seen_subnets:
            continue
        seen_subnets.add(prefix)
        for i in range(1, 255):
            h = f"{prefix}.{i}"
            if h not in skip_hosts:
                candidates.append(h)

    if not candidates:
        return []

    found: List[str] = []

    def _probe(host: str) -> Optional[str]:
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return host
        except Exception:
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=64) as ex:
        for res in ex.map(_probe, candidates):
            if res:
                found.append(res)
    return sorted(found, key=lambda x: (int(x.split(".")[2]), int(x.split(".")[3])))


def rediscover_printer_ip(
    printer_id: str,
    configured_ip: str,
    port: int,
    other_reserved_ips: Optional[Set[str]] = None,
    force_scan: bool = False,
) -> Optional[str]:
    """
    Tu dong quet lai mang Wi-Fi/LAN tim IP moi cua may in khi router cap DHCP IP khac hoac doi dai mang.
    Uu tien khop chinh xac dia chi MAC da luu; fallback an toan neu mang chi co 1 may in cong 9100 ranh roi.
    """
    port_i = int(port or 9100)
    now = time.time()
    if force_scan or (now - _LAST_SCAN_AT.get(port_i, 0.0) >= 15.0):
        _LAST_SCAN_HOSTS[port_i] = scan_network_printers(port_i)
        _LAST_SCAN_AT[port_i] = now

    found_ips = _LAST_SCAN_HOSTS.get(port_i) or []
    if not found_ips:
        return None

    arp = get_arp_table()
    cache = load_bridge_cache()
    pr_map = cache.get("printers") or {}
    saved_mac = ((pr_map.get(printer_id) or {}).get("mac") or "").lower()

    # 1. Khop chinh xac dia chi MAC phan cung cua may in nay
    if saved_mac:
        for cand_ip in found_ips:
            if (arp.get(cand_ip) or "").lower() == saved_mac:
                remember_printer_ip_mac(printer_id, configured_ip, cand_ip, port_i)
                return cand_ip

    # 2. Chua co MAC trong cache (hoac cau hinh 'AUTO'/'WIFI'/'LAN') -> chon may in 9100 chua gan cho may nao khac
    other_macs = {
        (info.get("mac") or "").lower()
        for pid, info in pr_map.items()
        if pid != printer_id and info.get("mac")
    }
    reserved_ips = set(other_reserved_ips or set())
    for pid, info in pr_map.items():
        if pid != printer_id and info.get("resolved_ip"):
            reserved_ips.add(info["resolved_ip"])

    unassigned = [
        cand_ip
        for cand_ip in found_ips
        if cand_ip not in reserved_ips and (arp.get(cand_ip) or "").lower() not in other_macs
    ]
    if is_auto_lan_target(configured_ip):
        pick = unassigned[0] if unassigned else found_ips[0]
        remember_printer_ip_mac(printer_id, configured_ip, pick, port_i)
        return pick
    if len(unassigned) == 1:
        pick = unassigned[0]
        remember_printer_ip_mac(printer_id, configured_ip, pick, port_i)
        return pick
    return None


def run_interactive_scanner() -> None:
    print("=" * 72)
    print("  CONG CU TU DONG DO TIM MAY IN HOA DON (USB & WI-FI/LAN) TAI QUAN")
    print("=" * 72)
    local_ips = get_local_lan_ips()
    local_ip = local_ips[0]
    parts = local_ip.split(".")
    subnet = ".".join(parts[:3]) + ".xxx" if len(parts) == 4 else "Khong xac dinh"
    print(f"  [1] Dia chi IP Wi-Fi/LAN cua Laptop   : {', '.join(local_ips)}")
    print(f"      -> Dai mang chinh cua quan ban la : {subnet}")
    print(f"      -> Neu dat IP tinh cho may in Bep, hay dat la: {'.'.join(parts[:3])}.201")
    print("-" * 72)

    print("  [2] Danh sach may in cam cong USB tren Laptop:")
    win_printers = list_windows_printers()
    usb_picked = resolve_windows_usb_printer("USB")
    if not win_printers:
        print("      - Chua thay may in nao tren Windows.")
    else:
        for name, port in win_printers:
            mark = "  <-- MAY IN NHIET USB DUOC CHON TU DONG" if (usb_picked and name == usb_picked) else ""
            safe_print(f"      - {name} (Cong: {port}){mark}")
    if usb_picked:
        print(f"      => Voi May in Thu ngan cam USB, ban chi can nhap chu: USB vao o IP tren web!")
    print("-" * 72)

    print(f"  [3] Dang quet toan bo mang Wi-Fi ({subnet}) de tim May in Wi-Fi / LAN (cong 9100)...")
    found_ips = scan_network_printers(9100)
    arp = get_arp_table()
    if not found_ips:
        print("      - Chua phat hien may in Wi-Fi/LAN nao dang bat tren mang.")
        print("        (Dam bao may in Bep da bat nguon va da ket noi vao Wi-Fi cua quan).")
    else:
        for ip in found_ips:
            mac = arp.get(ip) or "chua ro MAC"
            safe_print(f"      + TIM THAY MAY IN WI-FI/LAN TAI IP: {ip} (Cong 9100 - MAC: {mac})")
        print(f"      => Hay nhap dia chi IP {found_ips[0]} (hoac chu AUTO) vao dong May in Bep tren web!")
    print("=" * 72)


def http_json(url: str, method: str = "GET", payload: Any = None, timeout: float = 8.0) -> Dict[str, Any]:
    headers = {"Accept": "application/json", "User-Agent": "QuanNhauPrintBridge/2.1"}
    body_bytes = None
    if payload is not None:
        body_bytes = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def warmup_printer_macs(server: str) -> Set[str]:
    """Hoc truoc dia chi MAC cua cac may in Wi-Fi/LAN luc he thong binh thuong de du phong khi router doi IP."""
    reserved_ips: Set[str] = set()
    try:
        st = http_json(f"{server}/api/state", timeout=5.0)
        printers = (((st.get("state") or {}).get("config") or {}).get("printers") or [])
        for pr in printers:
            ip = str(pr.get("ip") or "").strip()
            pid = str(pr.get("id") or "").strip()
            port = int(pr.get("port") or 9100)
            if not ip or is_usb_target(ip) or is_auto_lan_target(ip):
                continue
            reserved_ips.add(ip)
            try:
                with socket.create_connection((ip, port), timeout=0.9):
                    mac = remember_printer_ip_mac(pid, ip, ip, port)
                    if mac:
                        safe_print(f"[Khoi dong] Da ghi nho MAC may in '{pr.get('name')}' ({ip} - MAC {mac})")
            except Exception:
                pass
    except Exception:
        pass
    return reserved_ips


def try_print_job(
    job: Dict[str, Any],
    use_utf8: bool,
    beep: bool,
    known_lan_ips: Optional[Set[str]] = None,
) -> Tuple[bool, str]:
    printer_id = str(job.get("printerId") or "")
    ip = str(job.get("ip") or "").strip()
    port = int(job.get("port") or 9100)
    printer_name = job.get("printerName") or ip or printer_id
    backup_id = str(job.get("backupPrinterId") or "")
    backup_ip = str(job.get("backupIp") or "").strip()
    backup_port = int(job.get("backupPort") or 9100)
    backup_name = job.get("backupPrinterName") or backup_ip
    copies = max(1, min(5, int(job.get("copies") or 1)))

    if not ip and not backup_ip:
        return False, "NO_IP"

    raw = build_escpos_payload(job, use_utf8=use_utf8, beep=beep)
    cache = load_bridge_cache()
    pr_map = cache.get("printers") or {}
    other_ips = set(known_lan_ips or set())
    if ip:
        other_ips.discard(ip)

    def _attempt_endpoint(pid: str, cfg_ip: str, cfg_port: int, label: str, allow_rediscover: bool) -> Tuple[bool, str]:
        if is_usb_target(cfg_ip):
            desc = ""
            for _ in range(copies):
                desc = send_to_target(cfg_ip, cfg_port, raw)
            return True, f"{label} -> {desc} x{copies}"

        # Xay dung danh sach IP thu: uu tien resolved_ip da khop MAC (neu IP cau hinh khong bi chu quan doi moi)
        candidates: List[str] = []
        cached_info = pr_map.get(pid) or {}
        if is_auto_lan_target(cfg_ip):
            if cached_info.get("resolved_ip"):
                candidates.append(cached_info["resolved_ip"])
        else:
            if cached_info.get("configured_ip") == cfg_ip and cached_info.get("resolved_ip") and cached_info["resolved_ip"] != cfg_ip:
                candidates.append(cached_info["resolved_ip"])
            candidates.append(cfg_ip)

        err_msg = ""
        for cand_ip in candidates:
            try:
                desc = ""
                for _ in range(copies):
                    desc = send_to_target(cand_ip, cfg_port, raw)
            except Exception as exc:
                err_msg = str(exc)
                continue
            try:
                remember_printer_ip_mac(pid, cfg_ip, cand_ip, cfg_port)
            except Exception:
                pass
            return True, f"{label} -> {desc} x{copies}"

        if allow_rediscover:
            new_ip = rediscover_printer_ip(pid, cfg_ip, cfg_port, other_reserved_ips=other_ips)
            if new_ip and new_ip not in candidates:
                try:
                    desc = ""
                    for _ in range(copies):
                        desc = send_to_target(new_ip, cfg_port, raw)
                except Exception as exc:
                    err_msg = str(exc)
                else:
                    safe_print(f"[Tu dong cap nhat IP] May in '{label}' da doi IP: {cfg_ip} -> {new_ip} (tu dong ket noi lai thanh cong!)")
                    return True, f"{label} [IP moi {new_ip}] -> {desc} x{copies}"
        return False, f"{label} [{cfg_ip}]: {err_msg or 'Khong ket noi duoc'}"

    last_err = ""
    if ip:
        ok, res = _attempt_endpoint(printer_id, ip, port, printer_name, allow_rediscover=True)
        if ok:
            return True, res
        last_err = res

    if backup_ip and (backup_ip != ip or backup_port != port):
        ok, res = _attempt_endpoint(backup_id or (printer_id + "_bk"), backup_ip, backup_port, f"May du phong ({backup_name})", allow_rediscover=True)
        if ok:
            return True, res
        last_err = res

    return False, last_err


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            if hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="Cau noi in nhiet K80 tu dong (USB + Wi-Fi/LAN) cho Quan Nhau OS")
    parser.add_argument("--server", default=DEFAULT_SERVER, help="Dia chi website he thong (mac dinh: https://munbao.com)")
    parser.add_argument("--interval", type=float, default=1.5, help="Chu ky kiem tra lenh in moi (giay)")
    parser.add_argument("--utf8", action="store_true", help="Gui ma UTF-8 truc tiep (chi bat neu may in ho tro font UTF-8)")
    parser.add_argument("--no-beep", action="store_true", help="Tat coi bao bip bip tren may in Bep")
    parser.add_argument("--print-backlog", action="store_true", help="In ca cac phieu cu ton dong truoc luc bat phan mem")
    parser.add_argument("--scan", action="store_true", help="Quet va hien thi IP Wi-Fi cua quan + May in USB + May in Wi-Fi/LAN")
    args = parser.parse_args()

    if args.scan:
        run_interactive_scanner()
        return

    server = args.server.rstrip("/")
    local_ip = get_local_lan_ip()
    usb_auto = resolve_windows_usb_printer("USB")
    print("=" * 72)
    print("  QUAN NHAU OS - BO KET NOI MAY IN NHIET K80 v2.1 (TU DONG KHOI PHUC IP/MANG)")
    print("=" * 72)
    print(f"  May chu ket noi : {server}")
    print(f"  IP Wi-Fi Laptop : {local_ip}")
    safe_print(f"  May in USB      : {usb_auto or 'Chua cam hoac chua cai driver USB'}")
    print(f"  Chu ky quet     : {args.interval:.1f} giay/lan")
    print("  Co che chong rot: Tu ket noi lai khi rot mang + Tu do IP moi neu Router doi IP.")
    print("  Huong dan       : Giu cua so nay mo (hoac thu nho xuong thanh Taskbar).")
    print("                    - May Thu ngan cam USB: dien 'USB' vao o IP tren web.")
    print("                    - May Bep bat Wi-Fi/LAN: dien IP (hoac 'AUTO') vao o IP.")
    print("=" * 72)

    warned_no_ip: Set[str] = set()
    known_lan_ips = warmup_printer_macs(server)

    # Bo qua phieu cu ton dong truoc thoi diem mo may tinh (tranh in lai phieu cu tu hom truoc)
    if not args.print_backlog:
        try:
            init_q = http_json(f"{server}/api/print-queue?max_age_sec=86400")
            now_ms = int(init_q.get("at") or (time.time() * 1000))
            stale_ids = [
                j["id"]
                for j in (init_q.get("jobs") or [])
                if (now_ms - int(j.get("printedAt") or 0)) > 60_000
            ]
            if stale_ids:
                http_json(f"{server}/api/print-queue/ack", method="POST", payload={"ids": stale_ids})
                print(f"[Khoi dong] Da bo qua {len(stale_ids)} phieu cu truoc luc bat may.")
        except Exception as exc:
            print(f"[Canh bao] Chua ket noi duoc {server} luc khoi dong: {exc}")

    print("[San sang] Dang lang nghe lenh in tu he thong...\n")

    offline_since: Optional[float] = None
    last_offline_log = 0.0
    pending_ack_ids: Set[str] = set()

    while True:
        try:
            # Giu hang doi cho 30 phut (1800s) de lo rot mang co mang lai van in bu day du
            res = http_json(f"{server}/api/print-queue?max_age_sec=1800")
            if offline_since is not None:
                dur = int(time.time() - offline_since)
                ts_ok = datetime.now().strftime("%H:%M:%S")
                print(f"[{ts_ok}] [Da co mang tro lai] Ket noi lai thanh cong toi {server} (sau {dur}s mat mang)!")
                offline_since = None
                last_offline_log = 0.0
                if not known_lan_ips:
                    known_lan_ips = warmup_printer_macs(server)

            jobs: List[Dict[str, Any]] = res.get("jobs") or []
            acked: List[str] = []
            for j in jobs:
                j_ip = str(j.get("ip") or "").strip()
                if j_ip and not is_usb_target(j_ip) and not is_auto_lan_target(j_ip):
                    known_lan_ips.add(j_ip)

            for job in jobs:
                jid = str(job.get("id") or "")
                if jid and (jid in pending_ack_ids or was_printed_locally(jid)):
                    # Phieu nay da in ra giay roi (chi chua kip ack do rot mang dung giay do) -> khong in trung
                    acked.append(jid)
                    continue

                ok, detail = try_print_job(job, use_utf8=args.utf8, beep=not args.no_beep, known_lan_ips=known_lan_ips)
                if ok:
                    ts = datetime.now().strftime("%H:%M:%S")
                    safe_print(f"[{ts}] DA IN -> {job.get('title')} | {detail}")
                    mark_printed_locally(jid)
                    if jid:
                        pending_ack_ids.add(jid)
                        acked.append(jid)
                elif detail == "NO_IP":
                    pid = job.get("printerId") or "unknown"
                    if pid not in warned_no_ip:
                        warned_no_ip.add(pid)
                        safe_print(
                            f"[Chua cau hinh] May in '{job.get('printerName')}' ({pid}) chua co IP hoac USB."
                            " -> Vao Chu quan -> Thiet lap -> May in -> Nhap 'USB' (neu cam day USB) hoac IP Wi-Fi/LAN ('AUTO') roi bam Luu."
                        )
                else:
                    ts = datetime.now().strftime("%H:%M:%S")
                    safe_print(f"[{ts}] LOI KET NOI MAY IN -> {job.get('title')} | {detail}")

            to_ack = sorted(set(acked) | pending_ack_ids)
            if to_ack:
                http_json(f"{server}/api/print-queue/ack", method="POST", payload={"ids": to_ack})
                pending_ack_ids.difference_update(to_ack)
        except KeyboardInterrupt:
            print("\nDa dung bo ket noi may in.")
            sys.exit(0)
        except (urllib.error.URLError, OSError, TimeoutError) as net_err:
            now = time.time()
            if offline_since is None:
                offline_since = now
            if now - last_offline_log >= 30.0:
                ts_err = datetime.now().strftime("%H:%M:%S")
                safe_print(f"[{ts_err}] [Mat mang tam thoi] Dang cho co mang de tu ket noi lai {server}... ({net_err})")
                last_offline_log = now
            time.sleep(3.0)
        except Exception as exc:
            ts_ex = datetime.now().strftime("%H:%M:%S")
            safe_print(f"[{ts_ex}] [Loi tam thoi] {exc}")
            time.sleep(3.0)

        time.sleep(max(0.8, args.interval))


if __name__ == "__main__":
    main()
