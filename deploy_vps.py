# -*- coding: utf-8 -*-
"""
deploy_vps.py - Script cap nhat code tu may Dev len VPS Production (https://munbao.com)
Luu y quan trong:
- VPS 14.225.253.239 dang chay nhieu he thong khac nhau.
- Script nay CHI dong bo thu muc /opt/quan_nhau va khoi dong lai duy nhat container `quannhau-app`,
  tuyet doi khong anh huong den cac container hay dich vu khac tren VPS.
"""

import os
import paramiko

HOST = os.environ.get("VPS_HOST", "14.225.253.239")
PORT = int(os.environ.get("VPS_PORT", "22"))
USER = os.environ.get("VPS_USER", "root")
PASS = os.environ.get("VPS_PASS", "2W5K12HgoaOPVaaSr5iT")
REMOTE_ROOT = "/opt/quan_nhau"
LOCAL_ROOT = os.path.dirname(os.path.abspath(__file__))


def upload_dir(sftp, local_dir, remote_dir):
    try:
        sftp.stat(remote_dir)
    except IOError:
        sftp.mkdir(remote_dir)
    for item in os.listdir(local_dir):
        if item in ("pgdata", "__pycache__", ".git", ".venv", "venv", "postgres.log", ".env"):
            continue
        local_path = os.path.join(local_dir, item)
        remote_path = f"{remote_dir}/{item}"
        if os.path.isdir(local_path):
            upload_dir(sftp, local_path, remote_path)
        else:
            print(f"  Uploading { os.path.relpath(local_path, LOCAL_ROOT) } -> {remote_path}")
            sftp.put(local_path, remote_path)


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to VPS {HOST}:{PORT} as {USER}...")
    ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=20)
    sftp = ssh.open_sftp()

    print("1. Uploading backend/, web/, and print_agent/ to /opt/quan_nhau ...")
    upload_dir(sftp, os.path.join(LOCAL_ROOT, "backend"), f"{REMOTE_ROOT}/backend")
    upload_dir(sftp, os.path.join(LOCAL_ROOT, "web"), f"{REMOTE_ROOT}/web")
    if os.path.isdir(os.path.join(LOCAL_ROOT, "print_agent")):
        upload_dir(sftp, os.path.join(LOCAL_ROOT, "print_agent"), f"{REMOTE_ROOT}/print_agent")
    sftp.close()

    cmds = [
        "docker cp /opt/quan_nhau/web/. quannhau-app:/app/web/",
        "docker cp /opt/quan_nhau/backend/. quannhau-app:/app/backend/",
        "docker exec quannhau-app mkdir -p /app/print_agent",
        "docker cp /opt/quan_nhau/print_agent/. quannhau-app:/app/print_agent/",
        "docker restart quannhau-app",
        "sleep 3",
        "curl -s http://127.0.0.1:8765/api/health",
    ]
    print("2. Updating container quannhau-app and verifying health...")
    for cmd in cmds:
        print(f"   $ {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode("utf-8", errors="ignore").strip()
        err = stderr.read().decode("utf-8", errors="ignore").strip()
        if out:
            print("     OUT:", out[:300] + ("..." if len(out) > 300 else ""))
        if err:
            print("     ERR:", err)

    ssh.close()
    print("\nDeploy thanh cong len https://munbao.com !")


if __name__ == "__main__":
    main()
