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

// Configuração robusta com timeouts e error handling
const clientConfig = {
  authStrategy: new LocalAuth({ 
    dataPath: authPath,
    clientId: "fecitac-bot-session"
  }),
  puppeteer: {
    ...puppeteerConfig,
    timeout: 60000, // Timeout de 60s para operações
  },
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  }
};

let client = null;
let isInitializing = false;

// -------------------- Hardening robusto --------------------
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err?.message || err);
  // Não mata o processo, apenas loga
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err?.message || err);
  // Tenta recuperar o cliente se possível
  if (client && !isInitializing) {
    setTimeout(() => safeInit(true), 5000);
  }
});

// Função para criar cliente com error handling
function createClient() {
  try {
    if (client) {
      console.log("🔄 Destruindo cliente anterior...");
      client.removeAllListeners();
      client = null;
    }
    
    client = new Client(clientConfig);
    setupClientEvents();
    return client;
  } catch (error) {
    console.error("❌ Erro ao criar cliente:", error?.message || error);
    return null;
  }
}

// Configurar eventos do cliente com try/catch
function setupClientEvents() {
  if (!client) return;

  // Evento QR com error handling robusto
  client.on("qr", async (qr) => {
    try {
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
    } catch (error) {
      console.error("❌ Erro ao processar QR:", error?.message || error);
    }
  });

  // Evento authenticated com verificação de sessão
  client.on("authenticated", () => {
    try {
      console.log("🔐 Autenticado no WhatsApp.");
      isAuthenticated = true;
      latestQrPngB64 = null; // limpa QR após autenticação
    } catch (error) {
      console.error("❌ Erro no evento authenticated:", error?.message || error);
    }
  });

  // Evento auth_failure com cleanup robusto
  client.on("auth_failure", (msg) => {
    try {
      console.error("❌ Falha de autenticação:", msg);
      isAuthenticated = false;
      
      // Remove dados corrompidos com verificação
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log("🗑️ Dados de autenticação removidos para restart limpo");
      }
    } catch (e) {
      console.error("Erro ao limpar auth:", e?.message || e);
    }
  });

  // Evento ready com error handling e timeout
  client.on("ready", async () => {
    try {
      const readyTime = new Date().toLocaleString('pt-BR');
      console.log(`✅ Cliente pronto! Bot conectado em ${readyTime}`);
      isAuthenticated = true;

      const chats = await Promise.race([
        client.getChats(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao buscar chats')), 30000)
        )
      ]);
      
      console.log(`💬 Total de conversas encontradas: ${chats.length}`);

      const targetGroup = chats.find(
        (chat) =>
          chat.isGroup &&
          (chat.name?.includes("FECITAC") || chat.name?.includes("2025"))
      );

      if (targetGroup) {
        TARGET_GROUP_ID = targetGroup.id._serialized;
        console.log(`👥 Grupo encontrado: ${targetGroup.name}`);
      } else {
        console.log("ℹ️ Grupo alvo não encontrado. Bot responderá em qualquer conversa.");
      }

      console.log("📱 Bot ativo - aguardando mensagens...");
      
      // Log de status com intervalo seguro
      setInterval(() => {
        console.log(`🔄 Status: Bot online - ${new Date().toLocaleString('pt-BR')} - Auth: ${isAuthenticated}`);
      }, 5 * 60 * 1000);
      
    } catch (error) {
      console.error("❌ Erro ao inicializar bot:", error?.message || error);
    }
  });

  // Evento disconnected com reconexão controlada
  client.on("disconnected", (reason) => {
    try {
      console.error("🔌 Desconectado:", reason);
      isAuthenticated = false;
      
      // Aguarda antes de tentar reconectar
      setTimeout(() => {
        if (!isInitializing) {
          safeInit(true);
        }
      }, 5000);
    } catch (error) {
      console.error("❌ Erro no evento disconnected:", error?.message || error);
    }
  });

  // Eventos de mensagens com error handling robusto  
  client.on("message_create", async (msg) => {
    try {
      if (!msg.body || msg.from === "status@broadcast" || msg.fromMe) return;

      const isFromGroup = msg.from.endsWith("@g.us");
      const isFromTargetGroup = TARGET_GROUP_ID
        ? msg.from === TARGET_GROUP_ID || !isFromGroup
        : true;

      if (!isFromTargetGroup) return;

      // Processamento de mensagens com timeout
      await Promise.race([
        processMessage(msg),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao processar mensagem')), 15000)
        )
      ]);
      
    } catch (error) {
      console.error("❌ Erro ao processar mensagem:", error?.message || error);
    }
  });
}

// -------------------- Utilitário --------------------
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// -------------------- Processamento de Mensagens --------------------
async function processMessage(msg) {
  const triggers = [
    "menu", "oi", "olá", "ola", "dia", "tarde", "noite", 
    "bom dia", "boa tarde", "boa noite"
  ];
  
  const shouldShowMenu = triggers.some((w) =>
    msg.body.toLowerCase().includes(w)
  );

  if (shouldShowMenu) {
    const chat = await Promise.race([
      msg.getChat(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao obter chat')), 5000)
      )
    ]);
    
    const contact = await Promise.race([
      msg.getContact(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao obter contato')), 5000)
      )
    ]);
    
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
    return;
  }

  // Processar opções numéricas
  const opt = msg.body.trim();
  const responses = {
    "1": `📋 *INSCRIÇÃO NO EVENTO*\n\n📅 Até 27 de setembro\n🔗 https://centraldeeventos.ifc.edu.br/snctsrs-605159/`,
    "2": `📄 *RESUMO*\n\n📅 Prazo: até 21 de setembro\n🔗 Modelo: https://docs.google.com/document/d/15L93YkbHWvodpd6EpHOn5JiouzCKY_cz/edit?tab=t.0`,
    "3": `🎨 *BANNER*\n\n📅 Prazo: até 17/10/2025\n🔗 Modelo: https://docs.google.com/presentation/d/1fGZLR708imLeZxWrYVRte2bAh3QTsfLq/edit?usp=sharing&ouid=112398617982057251666&rtpof=true&sd=true\n🔗 Envio: https://drive.google.com/drive/folders/1ycinrgeL4_4GxucBk4gaS4z2ziypHFYw?usp=drive_link`,
    "4": `📅 *PROGRAMAÇÃO GERAL*\n\n📋 Em breve será divulgado\n🔗 https://drive.google.com/drive/u/1/folders/1cw7Ru5Q_On1S19tMnhWF5uwk19qlhQzl`,
    "5": `👥 *ATENDIMENTO HUMANO*\n⏰ 8h às 17h — Aguarde que responderemos!`
  };

  if (responses[opt]) {
    const chat = await Promise.race([
      msg.getChat(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao obter chat')), 5000)
      )
    ]);
    
    await chat.sendStateTyping();
    await delay(800);
    await chat.sendMessage(responses[opt]);
  }
}

// -------------------- Inicialização robusta --------------------
async function safeInit(isRetry = false) {
  if (isInitializing) {
    console.log("⏳ Inicialização já em andamento...");
    return;
  }

  isInitializing = true;
  
  try {
    console.log(isRetry ? "🔄 Re-inicializando..." : "🚀 Inicializando WhatsApp...");
    
    // Criar novo cliente se necessário
    if (!client || isRetry) {
      client = createClient();
      if (!client) {
        throw new Error("Falha ao criar cliente");
      }
    }

    // Inicializar com timeout
    await Promise.race([
      client.initialize(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na inicialização')), 90000)
      )
    ]);
    
    console.log("✅ Inicialização concluída com sucesso");
    
  } catch (err) {
    console.error("❌ Erro ao inicializar:", err?.message || err);
    
    // Cleanup em caso de erro
    if (client) {
      try {
        client.removeAllListeners();
      } catch (e) {
        // Ignorar erros de cleanup
      }
      client = null;
    }
    
    // Retry com backoff exponencial
    const retryDelay = isRetry ? 10000 : 5000;
    console.log(`🔄 Tentando novamente em ${retryDelay/1000}s...`);
    setTimeout(() => {
      isInitializing = false;
      safeInit(true);
    }, retryDelay);
    return;
  }
  
  isInitializing = false;
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

// -------------------- Inicialização do Sistema --------------------
console.log("🚀 Iniciando FECITAC Bot...");
console.log(`📍 Ambiente: ${isProduction ? "Produção (Railway/Docker)" : "Local (Windows)"}`);
console.log(`💾 Dados de autenticação: ${authPath}`);

// Verificar se já tem sessão salva
if (fs.existsSync(authPath)) {
  console.log("🔑 Dados de sessão encontrados - tentando conectar...");
} else {
  console.log("🆕 Nova sessão - QR será gerado");
}

// Inicializar cliente
safeInit();
