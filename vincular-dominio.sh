#!/bin/bash

# Variáveis
PROJECT_ID="prj_vVAv9ZYmi4k663eQN4A7HsZ2j1gO"
DEPLOYMENT_URL="prevalidadorsefaz-fll1au98s-rodrigopaesrj-8422s-projects.vercel.app"
CUSTOM_DOMAIN="prevalidador_sefaz.nexus-tecnolog.ia.br"

echo "Tentando vincular domínio customizado..."
echo "Deployment: $DEPLOYMENT_URL"
echo "Domínio: $CUSTOM_DOMAIN"
echo ""
echo "⚠️  Este script requer um token de API do Vercel"
echo "Se você tiver um token, cole aqui (ou deixe em branco para pular):"
read -p "Token: " VERCEL_TOKEN

if [ -z "$VERCEL_TOKEN" ]; then
  echo ""
  echo "❌ Token não fornecido"
  echo ""
  echo "Alternativa: Configure via Vercel Dashboard"
  echo "1. Vá para: https://vercel.com/dashboard"
  echo "2. Abra o projeto: pre_validador_sefaz"
  echo "3. Clique em: Domains"
  echo "4. Clique em: Add Domain"
  echo "5. Digite: prevalidador_sefaz.nexus-tecnolog.ia.br"
  echo "6. Clique em: Add"
  exit 1
fi

echo ""
echo "Usando token de API para configurar domínio..."

curl -X POST "https://api.vercel.com/v10/projects/$PROJECT_ID/alias" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"alias\": \"$CUSTOM_DOMAIN\"}" 

echo ""
echo "Pronto!"
