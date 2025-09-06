# Força build para Linux/amd64 (mesmo em Windows x64)
FROM --platform=linux/amd64 node:20-bookworm-slim

# Atualiza e instala Chromium + deps necessárias pro Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
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
    wget curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia manifestos primeiro para aproveitar cache
COPY package*.json ./

# Não baixar o Chromium do Puppeteer (vamos usar o do sistema)
ENV PUPPETEER_SKIP_DOWNLOAD=true
# Dica: travar dependências exatamente como no package-lock
RUN npm ci --omit=dev

# Copia o restante do projeto
COPY . .

# informa ao Puppeteer onde está o executável do Chromium do sistema
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# Railway atribui a porta dinamicamente via variável PORT
# Não precisamos do EXPOSE fixo no Railway

# comando de inicialização - chatbot completo
CMD ["node", "chatbot.js"]