"""Bounded public-file checks; supplements human diff and history review."""
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "credential token": re.compile(r"(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-proj-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35})"),
    "hard-coded secret": re.compile(r"(?:api[_-]?key|secret|password|passwd|token)[\"']?\s*[:=]\s*[\"'][^\"'\s]{12,}[\"']", re.I),
    "machine user path": re.compile(r"(?:[A-Z]:[\\/]Users[\\/]|/Users/)[A-Za-z0-9_.-]+", re.I),
}
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})")
EMAIL_ALLOWED = ("noreply.github.com", "anthropic.com", "example.com", "example.org")
NOT_EMAIL_SUFFIX = (".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif")
FORBIDDEN = {".pdf", ".docx", ".pptx", ".xlsx", ".exe", ".msi", ".pem", ".key", ".pfx", ".p12"}
failures = []

def scan(label, data):
    if b"\x00" in data[:1000]:
        return
    text = data.decode("utf-8", errors="replace")
    for reason, pattern in PATTERNS.items():
        if pattern.search(text):
            failures.append(f"{label}: possible {reason} (review without printing matched value)")
    for match in EMAIL.finditer(text):
        domain = match.group(1).lower()
        if domain.endswith(NOT_EMAIL_SUFFIX) or any(domain == d or domain.endswith("." + d) for d in EMAIL_ALLOWED):
            continue
        failures.append(f"{label}: possible personal email address (review without printing matched value)")
        break

tracked = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
paths = [ROOT / p.decode() for p in tracked.split(b"\x00") if p]
if not paths:
    raise SystemExit("No tracked/indexed files to review; stage the intended public files first.")
for path in paths:
    relative = path.relative_to(ROOT).as_posix()
    parts = relative.lower().split("/")
    if (path.suffix.lower() in FORBIDDEN or any(p in {"private", "internal", "attachments", "startup", ".codex", ".claude", ".cursor"} for p in parts)
            or relative.lower().startswith(".kiro/settings/")
            or path.name in {".mcp.json", ".env"} or path.name.startswith(".env.") and path.name != ".env.example"):
        failures.append(relative + ": prohibited public path")
    if path.suffix == ".lspkg":
        with zipfile.ZipFile(path) as archive:
            if archive.testzip():
                failures.append(relative + ": corrupt archive")
            for entry in archive.infolist():
                if entry.file_size > 8_000_000:
                    failures.append(relative + ": large archive entry needs manual review")
                elif entry.filename.endswith((".ts", ".js", ".json", ".yaml", ".txt", ".md")):
                    scan(relative + "!" + entry.filename, archive.read(entry))
    elif path.stat().st_size <= 8_000_000:
        scan(relative, path.read_bytes())
if failures:
    print("\n".join(failures))
    raise SystemExit(1)
print(f"PASS: {len(paths)} indexed/tracked files checked, including package text entries.")
print("This bounded guard does not certify that every secret or private fact is detectable. Review diffs and history.")
