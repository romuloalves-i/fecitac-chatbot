// chatbot.js
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const fs = require("fs");
const path = require("path");

// === NEW: servidor para exibir o QR como imagem ===
const express = require("express");
const QR = require("qrcode");
const app = express();
let latestQrPngB64 = null; // guarda o último QR gerado em base64
let isAuthenticated = false;
let lastQrTime = 0;

let TARGET_GROUP_ID = null;

// -------------------- Detecta ambiente --------------------
const isProduction =
  !!process.env.RAILWAY_ENVIRONMENT ||
  !!process.env.RAILWAY_STATIC_URL ||
  process.env.NODE_ENV === "production";

// -------------------- Localiza Chrome no Windows (dev) --------------------
function findChromeWin() {
  const candidates = [
    "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
    "C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
    `C:\\\\Users\\\\${process.env.USERNAME}\\\\AppData\\\\Local\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe`,
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  return null;
}

// -------------------- Config Puppeteer (robusta) --------------------
const puppeteerConfig = {
  headless: isProduction,
  args: isProduction ? [
    "--no-sandbox",
    "--disable-setuid-sandbox", 
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--no-zygote",
    "--disable-features=site-per-process",
    "--disable-extensions",
    "--disable-default-apps",
    "--single-process",
  ] : [
    "--no-sandbox",
    "--disable-dev-shm-usage",
  ],
};

if (isProduction) {
  puppeteerConfig.executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";
} else {
  const chromePath = findChromeWin();
  if (chromePath) {
    puppeteerConfig.executablePath = chromePath;
    console.log("🌐 Usando Chrome (Windows):", chromePath);
  } else {
    console.warn(
      "⚠️ Chrome não encontrado no Windows. O Puppeteer tentará o padrão."
    );
  }
}

// -------------------- Instância do Client --------------------
const authPath = path.resolve("./.wwebjs_auth");
const client = new Client({
  authStrategy: new LocalAuth({ 
    dataPath: authPath,
    clientId: "fecitac-bot-session"
  }),
  puppeteer: puppeteerConfig,
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  }
});

// -------------------- Hardening --------------------
process.on("unhandledRejection", (err) =>
  console.error("UNHANDLED REJECTION:", err)
);
process.on("uncaughtException", (err) =>
  console.error("UNCAUGHT EXCEPTION:", err)
);

// -------------------- Eventos --------------------
client.on("qr", async (qr) => {
  const currentTime = Date.now();
  lastQrTime = currentTime;
  isAuthenticated = false;
  
  console.log("📲 QR CODE GERADO — sessão expirada ou nova");
  
  // QR ASCII apenas local (nos logs do Railway fica ilegível)
  if (!isProduction) {
    console.log("📱 QR para escaneamento:");
    qrcode.generate(qr, { small: true });
  }

  // Gera PNG em memória p/ servir via HTTP
  try {
    const buf = await QR.toBuffer(qr, { width: 400, margin: 2 });
    latestQrPngB64 = buf.toString("base64");
    console.log("✅ QR PNG gerado com sucesso");
  } catch (e) {
    console.error("❌ Erro ao gerar PNG do QR:", e);
  }

  const base =
    process.env.RAILWAY_STATIC_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN ||
    `http://localhost:${process.env.PORT || 3000}`;
    
  if (isProduction) {
    console.log(`🌐 ===== RAILWAY: ESCANEIE O QR ===== 🌐`);
    console.log(`📱 1. Abra este link no CELULAR:`);
    console.log(`🔗 ${base}/qr`);
    console.log(`📱 2. Escaneie o QR que aparece na tela`);
    console.log(`⏰ QR expira em ~20 segundos`);
    console.log(`🌐 ================================== 🌐`);
  } else {
    console.log(`🔗 Também disponível em: ${base}/qr`);
  }
  
  console.log(`⏰ QR gerado em: ${new Date(currentTime).toLocaleString('pt-BR')}`);
});

client.on("authenticated", () => {
  console.log("🔐 Autenticado no WhatsApp.");
  isAuthenticated = true;
  latestQrPngB64 = null; // limpa QR após autenticação
});

client.on("auth_failure", (msg) => {
  console.error("❌ Falha de autenticação:", msg);
  isAuthenticated = false;
  // Remove dados de auth corrompidos
  try {
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log("🗑️ Dados de autenticação removidos para restart limpo");
    }
  } catch (e) {
    console.error("Erro ao limpar auth:", e);
  }
});

client.on("ready", async () => {
  const readyTime = new Date().toLocaleString('pt-BR');
  console.log(`✅ Cliente pronto! Bot conectado em ${readyTime}`);
  isAuthenticated = true;

  try {
    const chats = await client.getChats();
    console.log(`💬 Total de conversas encontradas: ${chats.length}`);

    const targetGroup = chats.find(
      (chat) =>
        chat.isGroup &&
        (chat.name?.includes("FECITAC") || chat.name?.includes("2025"))
    );

    if (targetGroup) {
      TARGET_GROUP_ID = targetGroup.id._serialized;
      console.log(
        `👥 Grupo encontrado: ${targetGroup.name} (ID: ${TARGET_GROUP_ID})`
      );
    } else {
      console.log(
        "ℹ️ Grupo alvo não encontrado. O bot responderá em qualquer conversa."
      );
    }

    console.log("📱 Bot ativo - aguardando mensagens...");
    
    // Log de status a cada 5 minutos para monitoramento
    setInterval(() => {
      console.log(`🔄 Status: Bot online - ${new Date().toLocaleString('pt-BR')} - Auth: ${isAuthenticated}`);
    }, 5 * 60 * 1000);
    
  } catch (error) {
    console.error("❌ Erro ao inicializar bot:", error);
  }
});

client.on("disconnected", (reason) => {
  console.error("🔌 Desconectado:", reason);
  setTimeout(() => safeInit(true), 5000); // tenta reconectar
});

// -------------------- Utilitário --------------------
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// -------------------- Respostas --------------------
client.on("message_create", async (msg) => {
  if (!msg.body || msg.from === "status@broadcast") return;
  if (msg.fromMe) return;

  const isFromGroup = msg.from.endsWith("@g.us");
  const isFromTargetGroup = TARGET_GROUP_ID
    ? msg.from === TARGET_GROUP_ID || !isFromGroup
    : true;

  if (!isFromTargetGroup) return;

  const triggers = [
    "menu",
    "oi",
    "olá",
    "ola",
    "dia",
    "tarde",
    "noite",
    "bom dia",
    "boa tarde",
    "boa noite",
  ];
  const shouldShowMenu = triggers.some((w) =>
    msg.body.toLowerCase().includes(w)
  );

  if (shouldShowMenu) {
    try {
      const chat = await msg.getChat();
      const contact = await msg.getContact();
      const firstName = (contact.pushname || "colega").split(" ")[0];

      await chat.sendStateTyping();
      await delay(800);

      const menuMessage = `👋 Olá, ${firstName}!

🎓 Sou o assistente virtual da FECITAC

Escolha uma opção:
1️⃣ Inscrição no evento
2️⃣ Resumo/modelo
3️⃣ Banner/modelo
4️⃣ Programação Geral
5️⃣ Falar com atendente`;
      await chat.sendMessage(menuMessage);
    } catch (e) {
      console.error("Erro ao enviar menu:", e);
    }
    return;
  }

  // Opções
  const opt = msg.body.trim();
  try {
    const chat = await msg.getChat();
    if (opt === "1") {
      await chat.sendStateTyping();
      await delay(800);
      await chat.sendMessage(`📋 *INSCRIÇÃO NO EVENTO*

📅 Até 27 de setembro
🔗 https://centraldeeventos.ifc.edu.br/snctsrs-605159/`);
    } else if (opt === "2") {
      await chat.sendStateTyping();
      await delay(800);
      await chat.sendMessage(`📄 *RESUMO* 

📅 Prazo: até 21 de setembro
🔗 Modelo: https://docs.google.com/document/d/15L93YkbHWvodpd6EpHOn5JiouzCKY_cz/edit?tab=t.0`);
    } else if (opt === "3") {
      await chat.sendStateTyping();
      await delay(800);
      await chat.sendMessage(`🎨 *BANNER*

📅 Prazo: até 17/10/2025
🔗 Modelo: https://docs.google.com/presentation/d/1fGZLR708imLeZxWrYVRte2bAh3QTsfLq/edit?usp=sharing&ouid=112398617982057251666&rtpof=true&sd=true
🔗 Envio: https://drive.google.com/drive/folders/1ycinrgeL4_4GxucBk4gaS4z2ziypHFYw?usp=drive_link`);
    } else if (opt === "4") {
      await chat.sendStateTyping();
      await delay(800);
      await chat.sendMessage(`📅 *PROGRAMAÇÃO GERAL*

📋 Em breve será divulgado
🔗 https://drive.google.com/drive/u/1/folders/1cw7Ru5Q_On1S19tMnhWF5uwk19qlhQzl`);
    } else if (opt === "5") {
      await chat.sendStateTyping();
      await delay(800);
      await chat.sendMessage(`👥 *ATENDIMENTO HUMANO*
⏰ 8h às 17h — Aguarde que responderemos!`);
    }
  } catch (e) {
    console.error("Erro ao enviar resposta:", e);
  }
});

// -------------------- Inicialização com retry ÚNICA --------------------
async function safeInit(isRetry = false) {
  try {
    console.log(
      isRetry ? "🔄 Re-inicializando..." : "🚀 Inicializando WhatsApp..."
    );
    await client.initialize();
  } catch (err) {
    console.error("Erro ao inicializar:", err);
    setTimeout(() => safeInit(true), 5000);
  }
}

// -------------------- Servidor HTTP para QR --------------------
app.get("/", (_req, res) => {
  const statusText = isAuthenticated 
    ? "✅ Bot conectado e funcionando" 
    : latestQrPngB64 
    ? "📲 Escaneie o QR para conectar" 
    : "⏳ Aguardando geração do QR...";
    
  res.type("html").send(`
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="15">
    <style>
      body{font-family:system-ui;margin:1rem;text-align:center;background:#f8f9fa}
      .container{max-width:500px;margin:0 auto;padding:1rem;background:white;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}
      img{width:300px;height:300px;border:3px solid #007bff;border-radius:12px;margin:1rem 0}
      .status{padding:1rem;margin:1rem 0;border-radius:8px;font-weight:bold;font-size:1.1em}
      .connected{background:#d4edda;color:#155724;border:2px solid #c3e6cb}
      .waiting{background:#fff3cd;color:#856404;border:2px solid #ffeaa7}
      .qr-container{background:#f8f9fa;padding:1.5rem;border-radius:12px;margin:1rem 0}
      h1{color:#007bff;margin-bottom:0.5rem}
      .instructions{background:#e7f3ff;padding:1rem;border-radius:8px;margin:1rem 0;border-left:4px solid #007bff}
      .btn{display:inline-block;padding:0.75rem 1.5rem;background:#007bff;color:white;text-decoration:none;border-radius:6px;margin:0.5rem}
      .btn:hover{background:#0056b3}
    </style>
    <div class="container">
      <h1>🤖 FECITAC Bot</h1>
      <div class="status ${isAuthenticated ? 'connected' : 'waiting'}">${statusText}</div>
      
      ${
        !isAuthenticated && latestQrPngB64
          ? `
            <div class="instructions">
              <strong>📱 INSTRUÇÕES PARA CONECTAR:</strong><br>
              1. Abra o WhatsApp no celular<br>
              2. Toque nos 3 pontos > Dispositivos conectados<br>
              3. Toque em "Conectar um dispositivo"<br>
              4. Escaneie o QR abaixo
            </div>
            <div class="qr-container">
              <img alt="QR Code WhatsApp" src="data:image/png;base64,${latestQrPngB64}">
              <p><small>⏰ QR expira em ~20 segundos</small></p>
            </div>
            <a href="/qr" class="btn">🖼️ Ver QR em tela cheia</a>
          `
          : !isAuthenticated
          ? `
            <div class="instructions">
              ⏳ Aguardando geração do QR...<br>
              <small>Página atualiza automaticamente</small>
            </div>
          `
          : `
            <div class="instructions">
              🎉 <strong>Bot conectado com sucesso!</strong><br>
              O bot está funcionando 24h. Pode fechar esta aba.
            </div>
          `
      }
      
      <hr style="margin:2rem 0">
      <a href="/health" class="btn">🔍 Status técnico</a>
    </div>
  `);
});

app.get("/qr", (_req, res) => {
  if (!latestQrPngB64 || isAuthenticated) {
    return res.type("html").send(`
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>body{font-family:system-ui;text-align:center;margin:2rem;background:#f8f9fa}</style>
      <h2>QR não disponível</h2>
      <p>${isAuthenticated ? '✅ Bot já conectado!' : '⏳ QR ainda não foi gerado'}</p>
      <a href="/">← Voltar</a>
    `);
  }
  
  // Página HTML com QR em tela cheia
  res.type("html").send(`
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="20">
    <style>
      body{margin:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui}
      img{max-width:90vw;max-height:70vh;border:2px solid white;border-radius:8px}
      .info{color:white;text-align:center;margin:1rem}
      a{color:#4CAF50;text-decoration:none;font-size:1.1em}
    </style>
    <div class="info">
      <h2 style="color:white">📱 Escaneie com WhatsApp</h2>
      <p>⏰ QR expira em ~20 segundos</p>
    </div>
    <img alt="QR Code WhatsApp" src="data:image/png;base64,${latestQrPngB64}">
    <div class="info">
      <a href="/">← Voltar para página principal</a>
    </div>
  `);
});

app.get("/health", (_req, res) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  
  res.json({
    status: "ok",
    bot: {
      authenticated: isAuthenticated,
      target_group: !!TARGET_GROUP_ID,
      last_qr_time: lastQrTime ? new Date(lastQrTime).toISOString() : null
    },
    system: {
      uptime: Math.floor(uptime),
      uptime_human: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      memory_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      environment: isProduction ? "production" : "development"
    },
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const base =
    process.env.RAILWAY_STATIC_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN ||
    `http://localhost:${PORT}`;
  console.log(`🌐 HTTP pronto em ${base}  (QR em ${base}/qr)`);
});

// Boot
console.log("🚀 Iniciando FECITAC Bot...");
console.log(
  `📍 Ambiente: ${
    isProduction ? "Produção (Railway/Docker)" : "Local (Windows)"
  }`
);
console.log(`💾 Dados de autenticação: ${authPath}`);

// Verificar se já tem sessão
if (fs.existsSync(authPath)) {
  console.log("🔑 Dados de sessão encontrados - tentando conectar...");
} else {
  console.log("🆕 Nova sessão - QR será gerado");
}

safeInit();
