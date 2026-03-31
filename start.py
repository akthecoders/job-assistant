#!/usr/bin/env python3
"""
AI Job Assistant — cross-platform startup script.
Supports macOS, Linux, and Windows (CMD / PowerShell / Git Bash).
Run: python3 start.py   (or: python start.py on Windows)
"""

import sys
import os
import subprocess
import shutil
import platform
import socket
import hashlib
import json
import time
import threading
import webbrowser
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────────────────────

ROOT      = Path(__file__).parent.resolve()
BACKEND   = ROOT / "backend"
FRONTEND  = ROOT / "frontend"
EXTENSION = ROOT / "extension"
VENV      = BACKEND / ".venv"

IS_WINDOWS = platform.system() == "Windows"
IS_LINUX   = platform.system() == "Linux"
IS_MAC     = platform.system() == "Darwin"

if IS_WINDOWS:
    VENV_PYTHON   = VENV / "Scripts" / "python.exe"
    VENV_PIP      = VENV / "Scripts" / "pip.exe"
    VENV_UVICORN  = VENV / "Scripts" / "uvicorn.exe"
else:
    VENV_PYTHON   = VENV / "bin" / "python"
    VENV_PIP      = VENV / "bin" / "pip"
    VENV_UVICORN  = VENV / "bin" / "uvicorn"

STAMP_FILE = BACKEND / ".deps_hash"   # tracks when deps were last installed

# ──────────────────────────────────────────────────────────────────────────────
# Pretty output helpers
# ──────────────────────────────────────────────────────────────────────────────

BOLD  = "\033[1m"
GREEN = "\033[32m"
YELLOW= "\033[33m"
RED   = "\033[31m"
CYAN  = "\033[36m"
RESET = "\033[0m"

# Windows CMD doesn't support ANSI by default; disable colour there.
if IS_WINDOWS and "WT_SESSION" not in os.environ and "TERM" not in os.environ:
    BOLD = GREEN = YELLOW = RED = CYAN = RESET = ""

def banner(msg: str) -> None:
    print(f"\n{BOLD}{'═'*54}{RESET}")
    print(f"{BOLD}  {msg}{RESET}")
    print(f"{BOLD}{'═'*54}{RESET}")

def step(msg: str) -> None:
    print(f"\n{CYAN}▶{RESET} {BOLD}{msg}{RESET}")

def ok(msg: str) -> None:
    print(f"  {GREEN}✓{RESET} {msg}")

def warn(msg: str) -> None:
    print(f"  {YELLOW}⚠{RESET}  {msg}")

def fail(msg: str) -> None:
    print(f"  {RED}✗{RESET}  {msg}")

def die(msg: str) -> None:
    """Print a fatal error and exit, keeping the window open on Windows."""
    fail(msg)
    if IS_WINDOWS:
        print("\n  Press Enter to close this window...")
        try:
            input()
        except Exception:
            pass
    sys.exit(1)

def ask(prompt: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    try:
        answer = input(f"  {BOLD}?{RESET} {prompt}{suffix}: ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return default
    return answer or default

def run(cmd, cwd=None, check=True, capture=False, env=None):
    kwargs: dict = {
        "cwd": str(cwd or ROOT),
        "check": check,
        "env": env or os.environ.copy(),
    }
    if capture:
        kwargs["capture_output"] = True
        kwargs["text"] = True
    if isinstance(cmd, str):
        kwargs["shell"] = True
    return subprocess.run(cmd, **kwargs)

# ──────────────────────────────────────────────────────────────────────────────
# 1. Python version
# ──────────────────────────────────────────────────────────────────────────────

def check_python() -> None:
    step("Checking Python version")
    major, minor = sys.version_info[:2]
    if major < 3 or (major == 3 and minor < 11):
        fail(f"Python 3.11+ required — found {major}.{minor}")
        print("   Install the latest Python from https://python.org")
        print("   Or use pyenv / conda to manage versions.")
        die("Upgrade Python and re-run start.bat")
    ok(f"Python {major}.{minor} ({sys.executable})")

# ──────────────────────────────────────────────────────────────────────────────
# 2. Virtual environment — multiple fallback strategies
# ──────────────────────────────────────────────────────────────────────────────

def _venv_is_healthy() -> bool:
    return VENV_PYTHON.exists() and VENV_PIP.exists()

def _try_create_venv() -> bool:
    """Try the standard venv creation; return True on success."""
    try:
        run([sys.executable, "-m", "venv", str(VENV)], check=True, capture=True)
        return True
    except subprocess.CalledProcessError:
        return False

def _try_create_venv_without_pip() -> bool:
    """Create venv without pip, then bootstrap pip manually."""
    try:
        run([sys.executable, "-m", "venv", "--without-pip", str(VENV)],
            check=True, capture=True)
        # Bootstrap pip via get-pip.py
        import urllib.request
        get_pip = BACKEND / "_get_pip.py"
        print("    Downloading pip bootstrap...")
        urllib.request.urlretrieve("https://bootstrap.pypa.io/get-pip.py", str(get_pip))
        run([str(VENV_PYTHON), str(get_pip), "-q"], check=True)
        get_pip.unlink(missing_ok=True)
        return True
    except Exception:
        if VENV.exists():
            shutil.rmtree(VENV, ignore_errors=True)
        return False

def _try_install_venv_package_linux() -> bool:
    """On Debian/Ubuntu, try to install the python3-venv package."""
    if not IS_LINUX:
        return False
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}"
    candidates = [f"python{py_ver}-venv", "python3-venv"]
    for pkg in candidates:
        print(f"    Trying: sudo apt-get install -y {pkg}")
        r = run(["sudo", "apt-get", "install", "-y", pkg], check=False, capture=True)
        if r.returncode == 0:
            return True
    return False

def _try_virtualenv_fallback() -> bool:
    """Try installing and using the 'virtualenv' package as a fallback."""
    try:
        run([sys.executable, "-m", "pip", "install", "virtualenv", "-q"], check=True)
        run([sys.executable, "-m", "virtualenv", str(VENV), "-q"], check=True)
        return True
    except subprocess.CalledProcessError:
        return False

def setup_venv() -> None:
    step("Setting up virtual environment")

    if _venv_is_healthy():
        ok("Virtual environment already healthy")
        return

    # Wipe broken venv if it exists
    if VENV.exists():
        warn("Removing broken virtual environment...")
        shutil.rmtree(VENV, ignore_errors=True)

    print("  Creating .venv ...")

    strategies = [
        ("standard venv",              _try_create_venv),
        ("venv without pip + pip bootstrap", _try_create_venv_without_pip),
    ]

    if IS_LINUX:
        strategies.insert(1, ("apt install python3-venv", lambda: (
            _try_install_venv_package_linux() and _try_create_venv()
        )))

    strategies.append(("virtualenv package", _try_virtualenv_fallback))

    for name, strategy in strategies:
        print(f"  Trying: {name}...")
        try:
            if strategy() and _venv_is_healthy():
                ok(f"Virtual environment created ({name})")
                return
        except Exception as exc:
            print(f"    Failed: {exc}")

    fail("Could not create a Python virtual environment.")
    print()
    print("  Manual fix options:")
    print("    Windows: reinstall Python from https://python.org — ensure pip is included")
    print("    macOS:   brew install python@3.11")
    print("    Ubuntu:  sudo apt install python3-venv")
    print("    Any:     pip install virtualenv && virtualenv backend/.venv")
    die("Virtual environment setup failed.")

# ──────────────────────────────────────────────────────────────────────────────
# 3. Backend dependencies
# ──────────────────────────────────────────────────────────────────────────────

def _requirements_hash() -> str:
    req = (BACKEND / "requirements.txt").read_bytes()
    return hashlib.md5(req).hexdigest()

def _deps_are_current() -> bool:
    if not STAMP_FILE.exists():
        return False
    return STAMP_FILE.read_text().strip() == _requirements_hash()

def install_backend_deps() -> None:
    step("Backend Python dependencies")

    if _deps_are_current() and VENV_UVICORN.exists():
        ok("Already up to date")
        return

    print("  Upgrading pip...")
    run([str(VENV_PYTHON), "-m", "pip", "install", "--upgrade", "pip", "-q"])

    print("  Installing requirements.txt ...")
    run([str(VENV_PIP), "install", "-r", str(BACKEND / "requirements.txt"), "-q"])

    STAMP_FILE.write_text(_requirements_hash())
    ok("Backend dependencies installed")

# ──────────────────────────────────────────────────────────────────────────────
# 4. Node.js / npm
# ──────────────────────────────────────────────────────────────────────────────

def check_node() -> bool:
    step("Checking Node.js / npm")
    node = shutil.which("node") or shutil.which("node.exe")
    npm  = shutil.which("npm")  or shutil.which("npm.cmd")

    if not node or not npm:
        warn("Node.js / npm not found")
        print("   The React dashboard and Chrome extension won't be built.")
        print("   Install Node 18+ from https://nodejs.org")
        choice = ask("Continue without frontend? (y/n)", "y")
        return choice.lower().startswith("y")

    result = run(["node", "--version"], capture=True, check=False)
    ver_str = result.stdout.strip().lstrip("v") if result.returncode == 0 else "?"
    try:
        major = int(ver_str.split(".")[0])
        if major < 18:
            warn(f"Node {ver_str} detected — v18+ recommended")
        else:
            ok(f"Node v{ver_str}")
    except ValueError:
        ok("Node found")
    return True

# ──────────────────────────────────────────────────────────────────────────────
# 5. Frontend build
# ──────────────────────────────────────────────────────────────────────────────

def _npm_cmd():
    return shutil.which("npm") or shutil.which("npm.cmd") or "npm"

def _frontend_needs_build() -> bool:
    dist = FRONTEND / "dist"
    if not dist.exists():
        return True

    pkg_json = FRONTEND / "package.json"
    if pkg_json.exists() and pkg_json.stat().st_mtime > dist.stat().st_mtime:
        return True

    src_dir = FRONTEND / "src"
    if src_dir.exists():
        src_newest = _newest_mtime(src_dir)
        if src_newest > dist.stat().st_mtime:
            return True

    return False

def build_frontend() -> None:
    step("Frontend dashboard")

    if not _frontend_needs_build():
        ok("Already up to date")
        return

    node_modules = FRONTEND / "node_modules"
    if not node_modules.exists():
        print("  Installing npm packages (this may take a minute)...")
        run([_npm_cmd(), "install", "--legacy-peer-deps", "--prefer-offline"],
            cwd=FRONTEND)

    print("  Building React app...")
    run([_npm_cmd(), "run", "build"], cwd=FRONTEND)
    ok("Frontend built")

def _newest_mtime(directory: Path, suffixes: tuple = ('.ts', '.tsx', '.json', '.html', '.css')) -> float:
    """Return the most recent modification time of any matching file under `directory`."""
    newest = 0.0
    try:
        for p in directory.rglob('*'):
            if p.suffix in suffixes and p.is_file():
                t = p.stat().st_mtime
                if t > newest:
                    newest = t
    except Exception:
        pass
    return newest

def _extension_needs_build() -> bool:
    dist = EXTENSION / "dist"
    if not dist.exists():
        return True

    # Check dist age vs package.json
    pkg_json = EXTENSION / "package.json"
    if pkg_json.exists() and pkg_json.stat().st_mtime > dist.stat().st_mtime:
        return True

    # Check dist age vs any source file under extension/src/
    src_dir = EXTENSION / "src"
    if src_dir.exists():
        src_newest = _newest_mtime(src_dir)
        if src_newest > dist.stat().st_mtime:
            return True

    return False

def build_extension() -> None:
    step("Chrome extension")

    if not shutil.which("npm") and not shutil.which("npm.cmd"):
        warn("npm not found — extension not built. Install Node.js to build it.")
        return

    if not _extension_needs_build():
        ok("Already up to date")
        return

    node_modules = EXTENSION / "node_modules"
    if not node_modules.exists():
        print("  Installing npm packages...")
        run([_npm_cmd(), "install", "--legacy-peer-deps", "--prefer-offline"],
            cwd=EXTENSION)

    print("  Building extension...")
    run([_npm_cmd(), "run", "build"], cwd=EXTENSION)
    ok("Extension built — reload it in Chrome: chrome://extensions → ↻")

# ──────────────────────────────────────────────────────────────────────────────
# 6. AI provider check (first-run guidance only)
# ──────────────────────────────────────────────────────────────────────────────

def check_ai_provider() -> None:
    step("AI provider configuration")
    db_path = BACKEND / "data.db"
    if not db_path.exists():
        # DB will be created on first server start — nothing to check yet
        warn("Database not yet initialised — will be created on first start")
        print("   After the server starts, go to Settings to configure your AI provider.")
        return

    try:
        import sqlite3
        con = sqlite3.connect(str(db_path))
        cur = con.execute("SELECT key, value FROM settings")
        settings = {k: json.loads(v) for k, v in cur.fetchall()}
        con.close()
    except Exception:
        warn("Could not read settings — will be configured on first run")
        return

    provider = settings.get("provider", "ollama")
    if provider == "anthropic":
        key = settings.get("anthropic_api_key", "")
        if not key:
            warn("Anthropic selected but API key is not set")
            set_key = ask("Enter your Anthropic API key now (or press Enter to set it later)", "")
            if set_key.startswith("sk-"):
                try:
                    import sqlite3
                    con = sqlite3.connect(str(db_path))
                    con.execute(
                        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                        ("anthropic_api_key", json.dumps(set_key))
                    )
                    con.commit(); con.close()
                    ok("API key saved")
                except Exception as e:
                    warn(f"Could not save key: {e} — set it in Settings after start")
            else:
                warn("Key not saved — configure it in Settings > AI Provider")
        else:
            ok(f"Anthropic (key set, model: {settings.get('anthropic_model', '?')})")
    else:
        # Ollama
        ollama_url = settings.get("ollama_url", "http://localhost:11434")
        try:
            import urllib.request
            urllib.request.urlopen(f"{ollama_url}/api/tags", timeout=2)
            ok(f"Ollama is running at {ollama_url}")
        except Exception:
            warn(f"Ollama not reachable at {ollama_url}")
            print("   Start Ollama with:  ollama serve")
            print("   Pull a model with:  ollama pull llama3.2")
            print("   Or switch to Anthropic in Settings after the server starts.")

# ──────────────────────────────────────────────────────────────────────────────
# 7. Port detection
# ──────────────────────────────────────────────────────────────────────────────

def find_free_port(start: int = 8000) -> int:
    for port in range(start, start + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("0.0.0.0", port))
                return port
            except OSError:
                continue
    return start  # give up; uvicorn will report the error

# ──────────────────────────────────────────────────────────────────────────────
# 8. Start server
# ──────────────────────────────────────────────────────────────────────────────

def start_server(port: int) -> None:
    banner("AI Job Assistant is starting!")
    url = f"http://localhost:{port}"
    print(f"  {GREEN}Dashboard :{RESET}  {url}")
    print(f"  {GREEN}API docs  :{RESET}  {url}/docs")
    print(f"  {YELLOW}Extension :{RESET}  Load  extension/dist  as an unpacked Chrome extension")
    print()
    print("  Press Ctrl+C to stop the server")
    print(f"{'═'*54}")

    # Auto-open browser after a short delay
    def _open_browser():
        time.sleep(2.5)
        try:
            webbrowser.open(url)
        except Exception:
            pass
    threading.Thread(target=_open_browser, daemon=True).start()

    # Launch uvicorn.
    # - Unix: replace current process so Ctrl+C is forwarded cleanly.
    # - Windows: use subprocess.run because execv can mis-handle spaced paths.
    cmd = [
        str(VENV_PYTHON), "-m", "uvicorn",
        "main:app",
        "--host", "0.0.0.0",
        "--port", str(port),
        "--reload",
    ]
    if not IS_WINDOWS and hasattr(os, "execv"):
        os.chdir(str(BACKEND))
        os.execv(str(VENV_PYTHON), cmd)
    else:
        proc = subprocess.run(cmd, cwd=str(BACKEND))
        sys.exit(proc.returncode)

# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    banner("AI Job Assistant — Setup & Start")
    print(f"  OS: {platform.system()} {platform.release()}")
    print(f"  Python: {sys.version.split()[0]}")
    print(f"  Root: {ROOT}")

    check_python()
    setup_venv()
    install_backend_deps()

    has_node = check_node()
    if has_node:
        build_frontend()
        build_extension()

    check_ai_provider()

    port = find_free_port(8000)
    if port != 8000:
        warn(f"Port 8000 is busy — using port {port} instead")

    start_server(port)


def _windows_pause(msg: str = "") -> None:
    """On Windows keep the console open so the user can read errors."""
    if IS_WINDOWS:
        if msg:
            print(f"\n  {msg}")
        print("\n  Press Enter to close this window...")
        try:
            input()
        except Exception:
            pass


if __name__ == "__main__":
    # Detect double-click on Windows: the parent process is explorer.exe,
    # meaning there is no persistent terminal — warn the user.
    if IS_WINDOWS:
        try:
            import ctypes
            hwnd = ctypes.windll.kernel32.GetConsoleWindow()
            if hwnd:
                # Check if this console was created by this process (double-click)
                # vs inherited from an existing terminal (cmd.exe / PowerShell)
                import ctypes.wintypes
                pid = ctypes.wintypes.DWORD()
                ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                if pid.value == os.getpid():
                    print()
                    print("  TIP: For the best experience run from a terminal:")
                    print("       cmd.exe  →  start.bat")
                    print("       PowerShell  →  .\\start.bat")
                    print()
        except Exception:
            pass

    try:
        main()
    except KeyboardInterrupt:
        print("\n\nStopped.")
        sys.exit(0)
    except SystemExit as e:
        # sys.exit(1) from our own error handlers — keep window open on Windows
        if e.code and int(e.code) != 0:
            _windows_pause("Setup failed — scroll up to read the error.")
        raise
    except Exception as e:
        print(f"\n{RED}Unexpected error:{RESET} {e}")
        import traceback
        traceback.print_exc()
        _windows_pause("Unexpected error — scroll up to read the full traceback.")
        sys.exit(1)
