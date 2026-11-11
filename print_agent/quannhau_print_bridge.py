#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
quannhau_print_bridge.py - Cau noi in nhiet K80 tu dong qua mang LAN (ESC/POS TCP 9100)
Danh cho he thong Quan Nhau OS (https://munbao.com).

Co che hoat dong:
1. Chay ngam tren 1 may tinh bat ky trong cung mang Wi-Fi/LAN voi may in nhiet (thuong la may Thu ngan).
2. Moi 1.5 giay hoi may chu https://munbao.com/api/print-queue xem co phieu Bep / Ho ca / Tam tinh / Hoa don moi khong.
3. Neu co phieu moi va may in da duoc Chu quan nhap dia chi IP LAN (VD: 192.168.1.201, cong 9100),
   tu dong day lenh ESC/POS cat giay + coi bao "Bip bip" thang ra may in nhiet trong < 2 giay!
4. Neu may in chinh mat dien / dut day mang, tu dong chuyen sang IP may in du phong.
"""

import argparse
import json
import os
import socket
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Tuple

DEFAULT_SERVER = os.environ.get("QUANNHAU_SERVER_URL", "https://munbao.com")
LINE_WIDTH = 48  # Kho giay K80 tieu chuan: 48 ky tu Font A


def strip_vn(text: str) -> str:
    """Chuyen tieng Viet co dau sang khong dau ro net (tuong thich 100% may in nhiet Xprinter/Zywell/Epson)."""
    if not text:
        return ""
    s = str(text).replace("Đ", "D").replace("đ", "d")
    s = s.replace("–", "-").replace("—", "-").replace("·", "-").replace("→", "->")
    nfd = unicodedata.normalize("NFD", s)
    out = "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")
    return out.encode("ascii", "ignore").decode("ascii")


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

    # Ghi chu QR / VAT / Footer
    if doc.get("qrLabel"):
        buf.extend(encode_line(sep_dash, use_utf8))
        buf.extend(ALIGN_CENTER)
        buf.extend(encode_line(doc.get("qrLabel"), use_utf8))
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


def send_tcp_9100(ip: str, port: int, data: bytes, timeout: float = 4.0) -> None:
    with socket.create_connection((ip, int(port or 9100)), timeout=timeout) as sock:
        sock.sendall(data)


def http_json(url: str, method: str = "GET", payload: Any = None, timeout: float = 8.0) -> Dict[str, Any]:
    headers = {"Accept": "application/json", "User-Agent": "QuanNhauPrintBridge/1.0"}
    body_bytes = None
    if payload is not None:
        body_bytes = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def try_print_job(job: Dict[str, Any], use_utf8: bool, beep: bool) -> Tuple[bool, str]:
    ip = str(job.get("ip") or "").strip()
    port = int(job.get("port") or 9100)
    backup_ip = str(job.get("backupIp") or "").strip()
    backup_port = int(job.get("backupPort") or 9100)
    copies = max(1, min(5, int(job.get("copies") or 1)))

    if not ip and not backup_ip:
        return False, "NO_IP"

    raw = build_escpos_payload(job, use_utf8=use_utf8, beep=beep)
    targets = []
    if ip:
        targets.append((ip, port, job.get("printerName") or ip))
    if backup_ip and (backup_ip != ip or backup_port != port):
        targets.append((backup_ip, backup_port, f"May du phong ({backup_ip})"))

    last_err = ""
    for t_ip, t_port, t_label in targets:
        try:
            for _ in range(copies):
                send_tcp_9100(t_ip, t_port, raw)
            return True, f"{t_label} ({t_ip}:{t_port}) x{copies}"
        except Exception as exc:
            last_err = f"{t_label} [{t_ip}:{t_port}]: {exc}"
    return False, last_err


def main() -> None:
    parser = argparse.ArgumentParser(description="Cau noi in nhiet K80 tu dong qua mang LAN cho Quan Nhau OS")
    parser.add_argument("--server", default=DEFAULT_SERVER, help="Dia chi website he thong (mac dinh: https://munbao.com)")
    parser.add_argument("--interval", type=float, default=1.5, help="Chu ky kiem tra lenh in moi (giay)")
    parser.add_argument("--utf8", action="store_true", help="Gui ma UTF-8 truc tiep (chi bat neu may in ho tro font UTF-8)")
    parser.add_argument("--no-beep", action="store_true", help="Tat coi bao bip bip tren may in Bep")
    parser.add_argument("--print-backlog", action="store_true", help="In ca cac phieu cu ton dong truoc luc bat phan mem")
    args = parser.parse_args()

    server = args.server.rstrip("/")
    print("=" * 68)
    print("  QUAN NHAU OS - BO KET NOI MAY IN NHIET K80 TU DONG (LAN TCP 9100)")
    print("=" * 68)
    print(f"  May chu ket noi : {server}")
    print(f"  Chu ky quet     : {args.interval:.1f} giay/lan")
    print("  Huong dan       : Giu cua so nay mo (hoac thu nho xuong thanh Taskbar).")
    print("                    Moi mon Phuc vu bam gui se tu dong in ngay tai Bep!")
    print("=" * 68)

    warned_no_ip = set()

    # Bo qua phieu cu ton dong truoc thoi diem mo may tinh (tranh in lai phieu cu)
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
            print(f"[Canh bao] Chua ket noi duoc {server}: {exc}")

    print("[San sang] Dang lang nghe lenh in tu he thong...\n")

    while True:
        try:
            res = http_json(f"{server}/api/print-queue?max_age_sec=900")
            jobs: List[Dict[str, Any]] = res.get("jobs") or []
            acked: List[str] = []
            for job in jobs:
                ok, detail = try_print_job(job, use_utf8=args.utf8, beep=not args.no_beep)
                if ok:
                    ts = datetime.now().strftime("%H:%M:%S")
                    print(f"[{ts}] DA IN -> {job.get('title')} | {detail}")
                    acked.append(job["id"])
                elif detail == "NO_IP":
                    pid = job.get("printerId") or "unknown"
                    if pid not in warned_no_ip:
                        warned_no_ip.add(pid)
                        print(
                            f"[Chua nhap IP LAN] May in '{job.get('printerName')}' ({pid}) chua co IP LAN."
                            " -> Vao Chu quan -> Thiet lap -> May in -> Nhap IP LAN (VD: 192.168.1.201) roi bam Luu."
                        )
                else:
                    ts = datetime.now().strftime("%H:%M:%S")
                    print(f"[{ts}] LOI KET NOI MAY IN -> {job.get('title')} | {detail}")
            if acked:
                http_json(f"{server}/api/print-queue/ack", method="POST", payload={"ids": acked})
        except KeyboardInterrupt:
            print("\nDa dung bo ket noi may in.")
            sys.exit(0)
        except urllib.error.URLError as net_err:
            print(f"[Mat mang tam thoi] Dang thu ket noi lai {server}... ({net_err})")
            time.sleep(3.0)
        except Exception as exc:
            print(f"[Loi] {exc}")
            time.sleep(3.0)

        time.sleep(max(0.8, args.interval))


if __name__ == "__main__":
    main()
