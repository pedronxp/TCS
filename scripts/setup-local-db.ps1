# Script PowerShell para aplicar migrations e configurar o super admin
# Execute após iniciar o Docker Desktop

Write-Host "🚀 Iniciando Supabase local..." -ForegroundColor Cyan
npx supabase@2.110.0 start

Write-Host ""
Write-Host "📦 Aplicando migrations..." -ForegroundColor Cyan
npx supabase@2.110.0 db push --local

Write-Host ""
Write-Host "✅ Migrations aplicadas com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "🔑 Configurações aplicadas:" -ForegroundColor Yellow
Write-Host "  - Super admin: pedroallvess2001@gmail.com (role: owner)"
Write-Host "  - RPC: internal_reset_password"
Write-Host "  - RPC: provision_organization_with_coordinator"
Write-Host ""
Write-Host "🌐 Acesse o dashboard em:" -ForegroundColor Yellow
Write-Host "  - Dashboard: http://localhost:5173"
Write-Host "  - Supabase Studio: http://localhost:54323"
Write-Host ""
Write-Host "📝 Próximos passos:" -ForegroundColor Yellow
Write-Host "  1. Faça login em http://localhost:5173/login"
Write-Host "  2. Verifique o badge 'Owner' na sidebar"
Write-Host "  3. Teste criar organização com senha temporária"
Write-Host "  4. Teste resetar senha de usuário"
