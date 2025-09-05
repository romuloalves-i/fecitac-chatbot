#!/bin/bash

echo "🚀 Instalando FECITAC Chatbot no servidor ARM64..."

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18 para ARM64
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar dependências do sistema
sudo apt-get install -y \
    gconf-service \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget \
    chromium-browser

# Instalar PM2 para gerenciar o processo
sudo npm install -g pm2

# Instalar dependências do projeto
npm install

echo "✅ Instalação concluída!"
echo "📋 Para iniciar o bot:"
echo "   npm start                  # Modo normal"
echo "   pm2 start chatbot.js       # Modo daemon (recomendado)"
echo "   pm2 startup               # Auto-iniciar no boot"
echo "   pm2 save                  # Salvar configuração"