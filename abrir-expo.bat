@echo off
title Expo - TCS
cd /d "%~dp0"
echo Iniciando o Expo...
echo.
npm start -- --clear
echo.
echo O Expo foi encerrado. Pressione qualquer tecla para fechar.
pause >nul
