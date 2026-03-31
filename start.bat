@echo off
:: AI Job Assistant — Windows launcher
:: Delegates all logic to start.py so this file stays tiny.

setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"

:: ── Locate Python 3.11+ ──────────────────────────────────────────────────────
set "PYTHON="

:: Try py launcher first (installed with official Python for Windows)
for %%v in (3.13 3.12 3.11) do (
    if not defined PYTHON (
        py -%%v --version >nul 2>&1
        if !errorlevel! == 0 (
            set "PYTHON=py -%%v"
        )
    )
)

:: Try plain python / python3 commands
if not defined PYTHON (
    for %%c in (python python3) do (
        if not defined PYTHON (
            %%c -c "import sys; sys.exit(0 if sys.version_info>=(3,11) else 1)" >nul 2>&1
            if !errorlevel! == 0 (
                set "PYTHON=%%c"
            )
        )
    )
)

if not defined PYTHON (
    echo.
    echo   ERROR: Python 3.11+ is required but was not found.
    echo.
    echo   Install options:
    echo     - Download from https://python.org  (check "Add to PATH")
    echo     - winget install Python.Python.3.13
    echo     - scoop install python
    echo.
    pause
    exit /b 1
)

%PYTHON% "%SCRIPT_DIR%start.py" %*
