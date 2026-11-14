@echo off
rem Start this source checkout; no arguments; return the npm exit code.
setlocal EnableExtensions DisableDelayedExpansion
pushd "%~dp0" || exit /b 1
call npm.cmd start
set "result=%errorlevel%"
popd
if not "%result%"=="0" pause
exit /b %result%
