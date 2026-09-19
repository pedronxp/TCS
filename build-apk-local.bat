@echo off
title Build APK Local - TCS v1.3.52
cd /d "%~dp0"
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk
echo === Build local do APK (preview) - nao consome cota da Expo ===
echo ANDROID_HOME: %ANDROID_HOME%
echo.
call npx --yes eas-cli@latest build --platform android --profile preview --local --non-interactive
echo.
if %ERRORLEVEL% EQU 0 (
  echo === BUILD CONCLUIDO COM SUCESSO ===
) else (
  echo === BUILD FALHOU - codigo de erro %ERRORLEVEL% ===
)
echo O build foi encerrado. Pressione qualquer tecla para fechar.
pause >nul
