# Dockerfile para ARM64
FROM arm64v8/node:18-alpine

# Instalar dependências do sistema para ARM64
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    python3 \
    make \
    g++

# Variáveis do Chromium para ARM64
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Diretório de trabalho
WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar dependências
RUN npm install --only=production

# Copiar código
COPY . .

# Porta (se necessário)
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "start"]