# Solar: file types refused as "Demanda" (module) attachments — executables and scripts.

import os

BLOCKED_EXTENSIONS = {
    ".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".pif", ".cpl", ".dll", ".sys",
    ".sh", ".bash", ".zsh", ".csh", ".ps1", ".psm1", ".vbs", ".vbe", ".wsf", ".wsh", ".hta",
    ".jar", ".apk", ".app", ".deb", ".rpm", ".bin", ".run", ".appimage", ".dmg", ".pkg",
    ".lnk", ".reg", ".msp", ".gadget", ".jse", ".js", ".mjs",
}  # fmt: skip

BLOCKED_MIME_TYPES = {
    "application/x-msdownload",
    "application/x-msdos-program",
    "application/x-dosexec",
    "application/vnd.microsoft.portable-executable",
    "application/x-executable",
    "application/x-sh",
    "application/x-shellscript",
    "text/x-shellscript",
    "application/x-bat",
    "application/x-msi",
    "application/java-archive",
    "application/x-apple-diskimage",
    "application/vnd.android.package-archive",
    "application/javascript",
    "text/javascript",
}


def is_blocked_attachment(name, mime_type):
    ext = os.path.splitext(name or "")[1].lower()
    return ext in BLOCKED_EXTENSIONS or (mime_type or "").lower() in BLOCKED_MIME_TYPES
