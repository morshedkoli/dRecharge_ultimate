@echo off
REM ────────────────────────────────────────────────────────────────────────────
REM dRecharge Agent — release build script (Windows)
REM Produces one APK per ABI with R8 + obfuscation enabled.
REM ────────────────────────────────────────────────────────────────────────────

cd /d "%~dp0"

echo [1/3] Cleaning previous build artifacts...
call flutter clean

echo [2/3] Fetching dependencies...
call flutter pub get

echo [3/3] Building per-ABI release APKs...
call flutter build apk ^
  --split-per-abi ^
  --release ^
  --obfuscate ^
  --split-debug-info=build\debug-info

echo.
echo Build complete. Output APKs in: build\app\outputs\flutter-apk\
dir /b "build\app\outputs\flutter-apk\*-release.apk" 2>nul

echo.
echo IMPORTANT: Keep build\debug-info\ — required to deobfuscate crash traces.
