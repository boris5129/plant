@echo off
setlocal
where node.exe >nul 2>&1
if not errorlevel 1 (
  node.exe "%~dp0launch-local.mjs" %*
) else (
  "%ProgramFiles%\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\node\bin\node.exe" "%~dp0launch-local.mjs" %*
)
if errorlevel 1 (
  echo.
  echo PLANT FIT could not open. Check the error above.
  pause
  exit /b 1
)
