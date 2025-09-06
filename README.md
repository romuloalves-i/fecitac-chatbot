# 🤖 FECITAC 2025 - Chatbot WhatsApp

Bot automático para o grupo da **2ª FECITAC 2025** no WhatsApp.

## 🚀 Deploy no Servidor ARM64

### Opção 1: Instalação Manual
```bash
# 1. Clonar repositório
git clone [SEU_REPO]
cd chatbot

# 2. Executar script de instalação
chmod +x install.sh
./install.sh

# 3. Iniciar bot
pm2 start chatbot.js --name "fecitac-bot"
pm2 startup
pm2 save
```

### Opção 2: Docker (Recomendado)
```bash
# 1. Clonar repositório
git clone [SEU_REPO]
cd chatbot

# 2. Buildar e executar
docker-compose up -d

# 3. Ver logs (para escanear QR Code)
docker-compose logs -f fecitac-chatbot
```

### Opção 3: Railway/Render
- Upload do código no GitHub
- Conectar com Railway/Render
- Deploy automático

## 📱 Funcionalidades

- ✅ Funciona apenas no grupo FECITAC
- ✅ Menu automático para novos participantes
- ✅ Respostas automáticas para:
  - 1️⃣ Inscrição no evento
  - 2️⃣ Resumo
  - 3️⃣ Banner
  - 4️⃣ Programação Geral
  - 5️⃣ Atendimento humano

## 🔧 Comandos que ativam o bot:
`menu`, `oi`, `olá`, `dia`, `tarde`, `noite`

## 💰 Custo:
- Railway: Gratuito até $5/mês de uso
- Render: Gratuito (suspende após inatividade)
- Heroku: $7/mês# Force rebuild Sat, Sep  6, 2025 12:42:47 PM
