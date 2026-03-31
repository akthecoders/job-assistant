@echo off
:: AI Job Assistant — Windows launcher
:: Double-click this file OR run it from a terminal.
:: The window stays open after errors so you can read them.

setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"

echo.
echo  ══════════════════════════════════════════════════
echo    AI Job Assistant
echo  ══════════════════════════════════════════════════
echo.

:: ── Locate Python 3.11+ ──────────────────────────────────────────────────────
set "PYTHON="
set "PYTHON_CMD="

:: 1. Try the official Windows Python launcher (py.exe) with specific versions
for %%v in (3.13 3.12 3.11) do (
    if not defined PYTHON (
        py -%%v --version >nul 2>&1
        if !errorlevel! == 0 (
            set "PYTHON=py -%%v"
            set "PYTHON_CMD=py"
        )
    )
)

:: 2. Try plain python / python3 commands
if not defined PYTHON (
    for %%c in (python python3) do (
        if not defined PYTHON (
            %%c -c "import sys; sys.exit(0 if sys.version_info>=(3,11) else 1)" >nul 2>&1
            if !errorlevel! == 0 (
                set "PYTHON=%%c"
                set "PYTHON_CMD=%%c"
            )
        )
    )
)

if not defined PYTHON (
    echo.
    echo   ERROR: Python 3.11+ was not found on this machine.
    echo.
    echo   How to fix:
    echo     Option 1 ^(recommended^):
    echo       winget install Python.Python.3.13
    echo       ^(then close and reopen this window^)
    echo.
    echo     Option 2:
    echo       Download from https://python.org
    echo       IMPORTANT: tick "Add Python to PATH" during install
    echo.
    echo     Option 3:
    echo       scoop install python
    echo.
    goto :error_exit
)

echo   Found Python: %PYTHON%
echo.

:: ── Run the cross-platform Python bootstrap ───────────────────────────────────
%PYTHON% "%SCRIPT_DIR%start.py" %*
set "EXIT_CODE=!errorlevel!"

if !EXIT_CODE! neq 0 (
    echo.
    echo  ══════════════════════════════════════════════════
    echo    Something went wrong  ^(exit code: !EXIT_CODE!^)
    echo    Scroll up to read the error message above.
    echo  ══════════════════════════════════════════════════
    goto :error_exit
)

:: Normal exit after server stops (Ctrl+C)
echo.
echo   Server stopped. Goodbye!
goto :clean_exit

:error_exit
echo.
pause
exit /b 1

:clean_exit
exit /b 0
