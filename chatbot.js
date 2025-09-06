// chatbot.js
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const fs = require("fs");

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
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--no-zygote",
    "--disable-features=site-per-process",
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
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: puppeteerConfig,
});

// -------------------- Hardening --------------------
process.on("unhandledRejection", (err) =>
  console.error("UNHANDLED REJECTION:", err)
);
process.on("uncaughtException", (err) =>
  console.error("UNCAUGHT EXCEPTION:", err)
);

// -------------------- Eventos --------------------
client.on("qr", (qr) => {
  console.log("📲 QR CODE GERADO — escaneie no WhatsApp:");
  qrcode.generate(qr, { small: true });
  console.log(
    "🔗 QR como imagem:",
    `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
      qr
    )}`
  );
});

client.on("authenticated", () => console.log("🔐 Autenticado no WhatsApp."));

client.on("auth_failure", (msg) =>
  console.error("❌ Falha de autenticação:", msg)
);

client.on("ready", async () => {
  console.log("✅ Cliente pronto! Bot conectado.");

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

    console.log("📱 Envie 'oi' ou 'menu' para testar.");
  } catch (error) {
    console.error("Erro ao buscar grupo:", error);
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

// Keep-alive opcional
setInterval(() => console.log("⏱️ keep-alive"), 60 * 1000);

// Boot
console.log("🚀 Iniciando FECITAC Bot...");
console.log(
  `📍 Ambiente: ${
    isProduction ? "Produção (Railway/Docker)" : "Local (Windows)"
  }`
);
safeInit();
