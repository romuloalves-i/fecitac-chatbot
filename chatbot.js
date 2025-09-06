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

// -------------------- Gerenciamento de Ciclo de Vida do Container --------------------
class ContainerLifecycleManager {
  constructor() {
    this.isShuttingDown = false;
    this.activeBrowsers = new Set();
    this.activeOperations = new Set();
    this.shutdownTimeout = 30000; // 30s para shutdown
    this.setupSignalHandlers();
    this.setupErrorHandlers();
  }

  // Configura handlers para sinais do sistema
  setupSignalHandlers() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGQUIT'];
    signals.forEach(signal => {
      process.on(signal, () => this.gracefulShutdown(signal));
    });
  }

  // Configura tratamento global de erros
  setupErrorHandlers() {
    process.on("unhandledRejection", (err, promise) => {
      console.error("🔥 UNHANDLED REJECTION:", {
        error: err?.message || err,
        stack: err?.stack,
        promise: promise
      });
      // Não mata o processo - apenas loga para análise
    });

    process.on("uncaughtException", (err) => {
      console.error("💥 UNCAUGHT EXCEPTION:", {
        error: err?.message || err,
        stack: err?.stack
      });
      // Tenta recuperação controlada
      this.handleCriticalError(err);
    });
  }

  // Shutdown graceful com cleanup de recursos
  async gracefulShutdown(signal) {
    if (this.isShuttingDown) return;
    
    console.log(`🛑 Recebido ${signal} - Iniciando shutdown graceful...`);
    this.isShuttingDown = true;

    // Timeout de segurança
    const shutdownTimer = setTimeout(() => {
      console.log("⏰ Timeout de shutdown - forçando saída");
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      // 1. Para de aceitar novas operações
      isInitializing = true;

      // 2. Cleanup do cliente WhatsApp
      if (client) {
        console.log("🔄 Limpando cliente WhatsApp...");
        await this.cleanupWhatsAppClient();
      }

      // 3. Fecha browsers ativos
      console.log("🌐 Fechando browsers ativos...");
      await this.closeActiveBrowsers();

      // 4. Aguarda operações pendentes
      console.log("⏳ Aguardando operações pendentes...");
      await this.waitForPendingOperations();

      clearTimeout(shutdownTimer);
      console.log("✅ Shutdown concluído com sucesso");
      process.exit(0);

    } catch (error) {
      console.error("❌ Erro durante shutdown:", error);
      clearTimeout(shutdownTimer);
      process.exit(1);
    }
  }

  // Limpa cliente WhatsApp de forma segura
  async cleanupWhatsAppClient() {
    if (!client) return;

    try {
      // Remove todos os listeners
      client.removeAllListeners();
      
      // Tenta destruir o cliente de forma controlada
      if (typeof client.destroy === 'function') {
        await Promise.race([
          client.destroy(),
          new Promise(resolve => setTimeout(resolve, 5000))
        ]);
      }
    } catch (error) {
      console.error("Erro ao limpar cliente:", error?.message);
    } finally {
      client = null;
    }
  }

  // Fecha browsers Puppeteer ativos
  async closeActiveBrowsers() {
    const closePromises = Array.from(this.activeBrowsers).map(async browser => {
      try {
        await Promise.race([
          browser.close(),
          new Promise(resolve => setTimeout(resolve, 5000))
        ]);
      } catch (error) {
        console.error("Erro ao fechar browser:", error?.message);
      }
    });

    await Promise.all(closePromises);
    this.activeBrowsers.clear();
  }

  // Aguarda operações pendentes finalizarem
  async waitForPendingOperations(maxWait = 10000) {
    const start = Date.now();
    
    while (this.activeOperations.size > 0 && (Date.now() - start) < maxWait) {
      console.log(`⏳ Aguardando ${this.activeOperations.size} operações...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeOperations.size > 0) {
      console.log(`⚠️ ${this.activeOperations.size} operações ainda ativas após timeout`);
    }
  }

  // Registra browser ativo
  registerBrowser(browser) {
    this.activeBrowsers.add(browser);
  }

  // Remove browser do registro
  unregisterBrowser(browser) {
    this.activeBrowsers.delete(browser);
  }

  // Registra operação ativa
  registerOperation(operationId) {
    this.activeOperations.add(operationId);
    return () => this.activeOperations.delete(operationId);
  }

  // Tratamento de erros críticos
  handleCriticalError(error) {
    if (!this.isShuttingDown && client && !isInitializing) {
      console.log("🔄 Tentando recuperação após erro crítico...");
      setTimeout(() => {
        if (!this.isShuttingDown) {
          safeInit(true);
        }
      }, 5000);
    }
  }
}

// Instancia o gerenciador de ciclo de vida
const lifecycleManager = new ContainerLifecycleManager();

// -------------------- Pool de Operações Puppeteer Robustas --------------------
class PuppeteerOperationPool {
  constructor(lifecycleManager) {
    this.lifecycleManager = lifecycleManager;
    this.operationTimeout = 30000; // 30s timeout padrão
  }

  // Executa operação Puppeteer com timeout e error handling
  async executeOperation(operationName, operation, timeout = this.operationTimeout) {
    // Verifica se não estamos em shutdown
    if (this.lifecycleManager.isShuttingDown) {
      throw new Error(`Operação ${operationName} cancelada: container em shutdown`);
    }

    const operationId = `${operationName}-${Date.now()}`;
    const cleanup = this.lifecycleManager.registerOperation(operationId);

    try {
      console.log(`🔄 Iniciando operação: ${operationName}`);
      
      const result = await Promise.race([
        operation(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout na operação ${operationName}`)), timeout);
        })
      ]);

      console.log(`✅ Operação concluída: ${operationName}`);
      return result;

    } catch (error) {
      console.error(`❌ Erro na operação ${operationName}:`, error?.message || error);
      throw error;
    } finally {
      cleanup();
    }
  }

  // Verifica se sessão Puppeteer está ativa
  async isSessionActive(page) {
    try {
      if (!page || page.isClosed()) return false;
      
      // Testa uma operação simples
      await Promise.race([
        page.evaluate(() => true),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Session test timeout')), 5000))
      ]);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // Executa comando Puppeteer com verificação de sessão
  async safeExecute(page, commandName, command, timeout = 15000) {
    if (!(await this.isSessionActive(page))) {
      throw new Error(`Sessão inativa para comando: ${commandName}`);
    }

    return this.executeOperation(commandName, command, timeout);
  }
}

// Instancia o pool de operações
const puppeteerPool = new PuppeteerOperationPool(lifecycleManager);

// Função para criar cliente com gerenciamento robusto
function createClient() {
  try {
    // Verifica se não estamos em shutdown
    if (lifecycleManager.isShuttingDown) {
      console.log("⚠️ Não criando cliente: container em shutdown");
      return null;
    }

    if (client) {
      console.log("🔄 Destruindo cliente anterior...");
      try {
        client.removeAllListeners();
      } catch (error) {
        console.error("Erro ao remover listeners:", error?.message);
      }
      client = null;
    }
    
    console.log("🚀 Criando novo cliente WhatsApp...");
    client = new Client(clientConfig);
    setupClientEvents();
    
    // Registra browser quando disponível
    if (client.pupPage) {
      lifecycleManager.registerBrowser(client.pupPage.browser());
    }
    
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

// -------------------- Logging Estruturado --------------------
class StructuredLogger {
  constructor() {
    this.startTime = Date.now();
    this.stats = {
      operations: 0,
      errors: 0,
      crashes: 0,
      reconnects: 0
    };
  }

  // Log com contexto estruturado
  log(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    const logEntry = {
      timestamp,
      level,
      message,
      uptime: `${uptime}s`,
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      ...context,
      stats: this.stats
    };

    console.log(JSON.stringify(logEntry));
  }

  info(message, context) { this.log('info', message, context); }
  error(message, context) { 
    this.stats.errors++;
    this.log('error', message, context); 
  }
  warn(message, context) { this.log('warn', message, context); }
}

const logger = new StructuredLogger();

// -------------------- Inicialização Robusta com Logging --------------------
async function safeInit(isRetry = false) {
  if (isInitializing) {
    logger.warn("Inicialização já em andamento");
    return;
  }

  // Verifica se não estamos em shutdown
  if (lifecycleManager.isShuttingDown) {
    logger.warn("Inicialização cancelada: container em shutdown");
    return;
  }

  isInitializing = true;
  const initStartTime = Date.now();
  
  try {
    logger.info(isRetry ? "Re-inicializando cliente" : "Iniciando cliente", {
      retry: isRetry,
      attempt: isRetry ? ++logger.stats.reconnects : 1
    });
    
    // Usar pool de operações para criar cliente
    await puppeteerPool.executeOperation("create-client", async () => {
      if (!client || isRetry) {
        client = createClient();
        if (!client) {
          throw new Error("Falha ao criar cliente WhatsApp");
        }
      }
    });

    // Inicializar cliente com pool de operações
    await puppeteerPool.executeOperation("initialize-client", async () => {
      return client.initialize();
    }, 90000); // 90s timeout
    
    const initDuration = Date.now() - initStartTime;
    logger.info("Inicialização concluída com sucesso", {
      duration: `${initDuration}ms`,
      client_ready: true
    });
    
  } catch (err) {
    const initDuration = Date.now() - initStartTime;
    logger.error("Erro na inicialização", {
      error: err?.message || err,
      stack: err?.stack,
      duration: `${initDuration}ms`,
      retry: isRetry
    });
    
    // Cleanup controlado
    await cleanupFailedClient();
    
    // Retry com backoff exponencial (apenas se não estiver em shutdown)
    if (!lifecycleManager.isShuttingDown) {
      const retryDelay = isRetry ? 15000 : 8000;
      logger.info("Agendando nova tentativa", { 
        delay: `${retryDelay/1000}s`,
        next_attempt: logger.stats.reconnects + 1 
      });
      
      setTimeout(() => {
        isInitializing = false;
        safeInit(true);
      }, retryDelay);
    }
    return;
  }
  
  isInitializing = false;
}

// Cleanup de cliente com falha
async function cleanupFailedClient() {
  if (!client) return;

  try {
    await puppeteerPool.executeOperation("cleanup-failed-client", async () => {
      client.removeAllListeners();
      
      // Tenta fechar browser se existir
      if (client.pupPage && client.pupPage.browser) {
        const browser = client.pupPage.browser();
        lifecycleManager.unregisterBrowser(browser);
        await browser.close();
      }
    }, 10000);
  } catch (error) {
    logger.error("Erro durante cleanup", { error: error?.message });
  } finally {
    client = null;
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

// Health check robusto
app.get("/health", (_req, res) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  
  const healthData = {
    status: "ok",
    server: {
      running: true,
      port: PORT,
      host: HOST,
      url: process.env.RAILWAY_STATIC_URL || `http://${HOST}:${PORT}`
    },
    bot: {
      authenticated: isAuthenticated,
      target_group: !!TARGET_GROUP_ID,
      last_qr_time: lastQrTime ? new Date(lastQrTime).toISOString() : null,
      initializing: isInitializing,
      shutdown: lifecycleManager?.isShuttingDown || false
    },
    system: {
      uptime: Math.floor(uptime),
      uptime_human: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      memory_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      environment: isProduction ? "production" : "development",
      node_version: process.version
    },
    railway: {
      environment: process.env.RAILWAY_ENVIRONMENT || "none",
      static_url: process.env.RAILWAY_STATIC_URL || "none",
      public_domain: process.env.RAILWAY_PUBLIC_DOMAIN || "none"
    },
    timestamp: new Date().toISOString()
  };

  logger.info("Health check solicitado", healthData);
  res.json(healthData);
});

// Endpoint básico para testar conectividade
app.get("/ping", (_req, res) => {
  res.json({ 
    message: "pong", 
    timestamp: new Date().toISOString(),
    server: "FECITAC Bot Railway"
  });
});

// Tratamento de erro de servidor
app.use((err, req, res, next) => {
  logger.error("Erro no servidor Express", {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    error: "Erro interno do servidor",
    message: isProduction ? "Erro interno" : err.message,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Log detalhado da inicialização
console.log(`🔧 Configuração do servidor:`, {
  PORT,
  HOST,
  NODE_ENV: process.env.NODE_ENV,
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
  RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL
});

// -------------------- Inicialização do Sistema --------------------
console.log("🚀 Iniciando FECITAC Bot...");
console.log(`📍 Ambiente: ${isProduction ? "Produção (Railway/Docker)" : "Local (Windows)"}`);
console.log(`💾 Dados de autenticação: ${authPath}`);

// PRIMEIRO: Inicializar servidor HTTP (essencial para Railway)
app.listen(PORT, HOST, () => {
  const base =
    process.env.RAILWAY_STATIC_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN ||
    `http://${HOST}:${PORT}`;
  
  console.log(`🌐 HTTP servidor iniciado!`);
  console.log(`📍 Host: ${HOST}`);
  console.log(`🔌 Porta: ${PORT}`);
  console.log(`🔗 URL: ${base}`);
  console.log(`📱 QR: ${base}/qr`);
  
  // Log estruturado para Railway
  logger.info("Servidor HTTP iniciado", {
    host: HOST,
    port: PORT,
    url: base,
    qr_url: `${base}/qr`
  });

  // SEGUNDO: Depois do servidor, inicializar WhatsApp (pode falhar)
  setTimeout(() => {
    console.log("🔄 Iniciando cliente WhatsApp...");
    
    // Verificar se já tem sessão salva
    if (fs.existsSync(authPath)) {
      console.log("🔑 Dados de sessão encontrados - tentando conectar...");
    } else {
      console.log("🆕 Nova sessão - QR será gerado");
    }

    // Inicializar cliente WhatsApp
    safeInit().catch(error => {
      console.error("❌ Erro fatal na inicialização WhatsApp:", error);
      logger.error("Falha crítica na inicialização", { error: error.message });
    });
  }, 2000); // Aguarda 2s após servidor HTTP estar pronto
});
