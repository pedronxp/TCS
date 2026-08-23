@echo off
REM TCS - Sobe painel web e bot WhatsApp em janelas separadas (nao caem).
REM Painel: http://localhost:5173  |  Bot: http://localhost:8787
start "TCS Bot WhatsApp" cmd /k "cd /d "%~dp0bot-whatsapp" && npm start"
start "TCS Painel Web" cmd /k "cd /d "%~dp0dashboard" && npm run dev"
echo.
echo Painel: http://localhost:5173
echo Bot:    http://localhost:8787
echo As duas janelas abertas devem permanecer rodando durante o uso.
pause
