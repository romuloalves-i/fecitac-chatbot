#!/bin/bash

echo "🤖 Iniciando FECITAC Chatbot localmente..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    echo "💡 Instale Node.js 18+ em: https://nodejs.org"
    exit 1
fi

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Iniciar bot
echo "🚀 Iniciando bot..."
echo "📱 Escaneie o QR Code que aparecerá abaixo:"
echo ""
node chatbot.js