@echo off
title Build APK Local - TCS v1.3.59
cd /d "%~dp0android"
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk
set NODE_ENV=production
echo === Build Gradle assembleRelease v1.3.59 (keystore oficial) ===
echo keystore.properties existe:
if exist keystore.properties (echo   SIM) else (echo   NAO - ABORTANDO & goto fim)
call gradlew.bat assembleRelease
echo.
if %ERRORLEVEL% EQU 0 (
  echo === BUILD CONCLUIDO ===
  dir "app\build\outputs\apk\release\app-release.apk"
) else (
  echo === BUILD FALHOU - codigo %ERRORLEVEL% ===
)
:fim
echo Pressione qualquer tecla para fechar.
pause >nul
