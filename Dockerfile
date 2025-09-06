# Imagem Linux/amd64 (compatível com Windows x64 ao buildar)
FROM --platform=linux/amd64 node:20-bookworm-slim

# Instala Chromium + dependências que o Puppeteer/Chromium precisam
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./

# NÃO baixe o Chromium empacotado do puppeteer — usaremos o do sistema
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

COPY . .

# Diga ao Puppeteer onde está o Chromium do sistema
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

CMD ["node", "index.js"]