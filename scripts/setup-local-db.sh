#!/bin/bash
# Script para aplicar migrations e configurar o super admin
# Execute após iniciar o Docker Desktop

set -e

echo "🚀 Iniciando Supabase local..."
npx supabase@2.110.0 start

echo ""
echo "📦 Aplicando migrations..."
npx supabase@2.110.0 db push --local

echo ""
echo "✅ Migrations aplicadas com sucesso!"
echo ""
echo "🔑 Configurações aplicadas:"
echo "  - Super admin: pedroallvess2001@gmail.com (role: owner)"
echo "  - RPC: internal_reset_password"
echo "  - RPC: provision_organization_with_coordinator"
echo ""
echo "🌐 Acesse o dashboard em:"
echo "  - Dashboard: http://localhost:5173"
echo "  - Supabase Studio: http://localhost:54323"
echo ""
echo "📝 Próximos passos:"
echo "  1. Faça login em http://localhost:5173/login"
echo "  2. Verifique o badge 'Owner' na sidebar"
echo "  3. Teste criar organização com senha temporária"
echo "  4. Teste resetar senha de usuário"
