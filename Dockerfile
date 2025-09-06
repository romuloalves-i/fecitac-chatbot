# syntax=docker/dockerfile:1
FROM node:18-alpine

# Instalar Chromium e dependências do Puppeteer
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  udev \
  bash

# Diretório de trabalho
WORKDIR /app

# Copiar manifestos e instalar deps (sem dev)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar código
COPY . .

# Variáveis usadas pelo whatsapp-web.js/puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true \
    NODE_ENV=production \
    HEADLESS=true

# Subir o bot
CMD ["node", "chatbot.js"]