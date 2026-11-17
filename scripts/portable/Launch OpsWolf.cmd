@echo off
setlocal DisableDelayedExpansion
if not "%~2"=="" goto usage
if not "%~1"=="" if /i not "%~1"=="--check" goto usage
set "OPSWOLF_PORTABLE_ROOT=%~dp0"
for %%F in ("code-codex.exe" "code-codex-launcher.exe" "explorer.js" "storage-layout.json" "portable-manifest.json") do if not exist "%~dp0%%~F" goto incomplete
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -Command "{{VERIFY_COMMAND}}"
if errorlevel 1 goto invalid
if /i "%~1"=="--check" exit /b 0
start "" /d "%~dp0" "%~dp0code-codex-launcher.exe" run --ui-bundle "%~dp0explorer.js"
if errorlevel 1 goto failed
exit /b 0
:usage
echo Double-click Launch OpsWolf after extracting the whole ZIP, or use --check to verify without starting.
pause
exit /b 1
:incomplete
echo OpsWolf is missing a required file. Extract the complete ZIP into a new folder and try again.
echo Read README.txt for verification and recovery instructions.
if /i "%~1"=="--check" exit /b 1
pause
exit /b 1
:invalid
echo OpsWolf validation failed. Nothing was launched. Read the error above and README.txt.
if /i "%~1"=="--check" exit /b 1
pause
exit /b 1
:failed
echo Windows could not start OpsWolf. Read README.txt and preserve any startup error message.
pause
exit /b 1
