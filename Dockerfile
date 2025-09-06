# Dockerfile ultra-simples para quebrar cache Railway
FROM node:20-alpine

WORKDIR /app

# Apenas Express - zero deps WhatsApp
COPY package.json ./
RUN npm install --production --no-cache

# Copia apenas servidor simples
COPY simple-server.js ./

# Expõe porta dinâmica
ENV NODE_ENV=production

# Comando sem WhatsApp
CMD ["node", "simple-server.js"]