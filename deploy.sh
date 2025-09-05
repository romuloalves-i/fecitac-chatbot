#!/bin/bash

echo "🚀 Fazendo deploy do FECITAC Chatbot..."

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado. Instalando..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker instalado! Reinicie o terminal."
    exit 1
fi

# Parar container existente (se houver)
echo "🛑 Parando container anterior..."
docker-compose down

# Buildar e executar
echo "🔨 Buildando container ARM64..."
docker-compose up --build -d

# Mostrar status
echo "✅ Deploy concluído!"
echo "📋 Comandos úteis:"
echo "   docker-compose logs -f    # Ver logs em tempo real"
echo "   docker-compose down       # Parar bot"
echo "   docker-compose up -d      # Iniciar bot"

# Mostrar logs automaticamente
echo "📱 Aguardando QR Code..."
sleep 5
docker-compose logs -f fecitac-chatbot