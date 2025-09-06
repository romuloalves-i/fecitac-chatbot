const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

// Detectar ambiente
const isProduction = !!(
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_STATIC_URL ||
  process.env.NODE_ENV === "production"
);

// Encontrar Chrome no Windows
const findChrome = () => {
  const possiblePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Users\\" +
      process.env.USERNAME +
      "\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
  ];

  const fs = require("fs");
  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      return path;
    }
  }
  return null;
};

// Configuração do Puppeteer otimizada
const puppeteerConfig = {
  headless: isProduction ? true : false,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--no-zygote",
  ],
};

// Definir caminho do executável
if (isProduction) {
  puppeteerConfig.executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";
} else {
  const chromePath = findChrome();
  if (chromePath) {
    puppeteerConfig.executablePath = chromePath;
    console.log(`🌐 Usando Chrome: ${chromePath}`);
  }
}

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./.wwebjs_auth",
  }),
  puppeteer: puppeteerConfig,
});
// ID do grupo específico (será obtido quando o bot conectar)
let TARGET_GROUP_ID = null;

// serviço de leitura do qr code
client.on("qr", (qr) => {
  console.log("📱 QR CODE GERADO!");
  console.log("Escaneie este QR com seu WhatsApp:");
  qrcode.generate(qr, { small: true }); // ASCII
  console.log("\n🔗 Ou abra este link para ver o QR como imagem:");
  console.log(
    `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
      qr
    )}`
  );
  console.log("--------------------\n");
});

// autenticação
client.on("authenticated", () => {
  console.log("✅ Autenticado com sucesso!");
});

// pronto
client.on("ready", async () => {
  console.log("🚀 Tudo certo! WhatsApp conectado.");

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
        `Grupo encontrado: ${targetGroup.name} (ID: ${TARGET_GROUP_ID})`
      );
      console.log("🤖 Bot pronto! Aguardando mensagens no grupo...");
    } else {
      console.log(
        "Grupo não encontrado. Bot funcionará em TODAS as conversas."
      );
    }

    console.log("📱 Para testar, envie 'oi' ou 'menu' em qualquer conversa");
    console.log("🔍 Monitorando todas as mensagens...");

    // Aguardar um tempo para estabilizar a conexão
    setTimeout(() => {
      console.log(
        "🔄 Conexão estabilizada - bot pronto para receber mensagens!"
      );
    }, 3000);
  } catch (error) {
    console.error("Erro ao buscar grupo:", error);
  }
});

console.log("🚀 Iniciando FECITAC Bot...");
console.log(`📍 Ambiente: ${isProduction ? "Produção (Railway)" : "Local"}`);

// Inicializar cliente
(async () => {
  try {
    console.log("⏳ Conectando ao WhatsApp...");
    await client.initialize();
  } catch (error) {
    console.error("❌ Erro fatal ao inicializar:", error);
    process.exit(1);
  }
})();

// Utilitário: delay
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Log de entrada no grupo
client.on("group_join", async (notification) => {
  if (TARGET_GROUP_ID && notification.chatId === TARGET_GROUP_ID) {
    console.log(`✅ Novo participante entrou no grupo!`);
  }
});

// Processar mensagens (evitando repetições)
client.on("message_create", async (msg) => {
  // Ignorar mensagens vazias e de status
  if (!msg.body || msg.from === "status@broadcast") {
    return;
  }

  // Ignorar completamente mensagens do próprio bot
  if (msg.fromMe) {
    console.log("⏭️ Ignorando mensagem própria");
    return;
  }

  // Debug simplificado
  console.log(`📨 ${msg.fromMe ? "Enviada" : "Recebida"}: "${msg.body}"`);
  console.log(
    `📍 De: ${msg.from} | Grupo: ${msg.from.endsWith("@g.us") ? "Sim" : "Não"}`
  );

  // Verificar se deve processar mensagem
  const isFromTargetGroup = TARGET_GROUP_ID
    ? msg.from === TARGET_GROUP_ID || !msg.from.endsWith("@g.us") // Grupo específico OU conversa direta
    : true; // Se não encontrou grupo específico, aceita qualquer conversa

  const isFromGroup = msg.from.endsWith("@g.us");

  if (!isFromTargetGroup) {
    console.log("❌ Mensagem ignorada (não é do grupo/conversa alvo)");
    return;
  }

  console.log("✅ Processando mensagem...");

  // Trigger do menu - detecção simplificada
  const triggerWords = [
    "menu",
    "Oi",
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
  const shouldShowMenu =
    msg.body &&
    triggerWords.some((word) =>
      msg.body.toLowerCase().includes(word.toLowerCase())
    );

  if (shouldShowMenu && isFromTargetGroup) {
    try {
      const chat = await msg.getChat();
      const contact = await msg.getContact();
      const firstName = (contact.pushname || "colega").split(" ")[0];

      await chat.sendStateTyping();
      await delay(1000);

      const menuMessage = `👋 Olá, ${firstName}!

🎓 Sou o assistente virtual da FECITAC*

Como posso ajudá-lo? Digite uma das opções:

1️⃣ - Inscrição no evento
2️⃣ - Resumo/modelo
3️⃣ - Banner/modelo
4️⃣ - Programação Geral
5️⃣ - Falar com atendente`;

      await chat.sendMessage(menuMessage);
      console.log(`✅ Menu enviado para ${firstName}`);
    } catch (error) {
      console.error("❌ Erro ao enviar menu:", error);
    }
    return;
  }

  // Opção 1 - Inscrição
  if (msg.body.trim() === "1" && isFromTargetGroup) {
    try {
      const chat = await msg.getChat();
      await chat.sendStateTyping();
      await delay(800);

      const inscricaoMessage = `📋 *INSCRIÇÃO NO EVENTO*

📅 Data limite: 27 de setembro de 2025

🔗 Link para inscrição:
https://centraldeeventos.ifc.edu.br/snctsrs-605159/`;

      await chat.sendMessage(inscricaoMessage);
      console.log("✅ Informação de inscrição enviada");
    } catch (error) {
      console.error("❌ Erro ao enviar informação de inscrição:", error);
    }
    return;
  }

  // Opção 2 - Resumo
  if (msg.body.trim() === "2" && isFromTargetGroup) {
    try {
      const chat = await msg.getChat();
      await chat.sendStateTyping();
      await delay(800);

      const resumoMessage = `📄 *RESUMO*

📅 Prazo final para o envio do resumo : 21 de setembro de 2025

⚠️ É necessário seguir o modelo do site

🔗 Link do modelo:
https://docs.google.com/document/d/15L93YkbHWvodpd6EpHOn5JiouzCKY_cz/edit?tab=t.0`;

      await chat.sendMessage(resumoMessage);
      console.log("✅ Informação de resumo enviada");
    } catch (error) {
      console.error("❌ Erro ao enviar informação de resumo:", error);
    }
    return;
  }

  // Opção 3 - Banner
  if (msg.body.trim() === "3" && isFromTargetGroup) {
    try {
      const chat = await msg.getChat();
      await chat.sendStateTyping();
      await delay(800);

      const bannerMessage = `🎨 *BANNER*

📅 Prazo final para envio do banner: 17 de outubro de 2025

⚠️ Seguir modelo disponível no site

🔗 Link do modelo:
https://docs.google.com/presentation/d/1fGZLR708imLeZxWrYVRte2bAh3QTsfLq/edit?usp=sharing&ouid=112398617982057251666&rtpof=true&sd=true`;

      await chat.sendMessage(bannerMessage);
      console.log("✅ Informação de banner enviada");
    } catch (error) {
      console.error("❌ Erro ao enviar informação de banner:", error);
    }
    return;
  }

  // Opção 4 - Programação
  if (msg.body.trim() === "4" && isFromTargetGroup) {
    try {
      const chat = await msg.getChat();
      await chat.sendStateTyping();
      await delay(800);

      const programacaoMessage = `📅 *PROGRAMAÇÃO GERAL*

📋 Acesse a programação completa do evento: EM BREVE SERÁ DIVULGADO

🔗 Link da programação:
https://drive.google.com/drive/u/1/folders/1cw7Ru5Q_On1S19tMnhWF5uwk19qlhQzl`;

      await chat.sendMessage(programacaoMessage);
      console.log("✅ Informação de programação enviada");
    } catch (error) {
      console.error("❌ Erro ao enviar informação de programação:", error);
    }
    return;
  }

  // Opção 5 - Atendimento
  if (msg.body.trim() === "5" && isFromTargetGroup) {
    try {
      const chat = await msg.getChat();
      await chat.sendStateTyping();
      await delay(800);

      const atendimentoMessage = `👥 *ATENDIMENTO HUMANO*

📞 Aguarde: nossos atendentes irão responder o mais breve possível!

⏰ Horário de atendimento: 8h às 17h`;

      await chat.sendMessage(atendimentoMessage);
      console.log("✅ Solicitação de atendimento registrada");
    } catch (error) {
      console.error("❌ Erro ao processar solicitação de atendimento:", error);
    }
    return;
  }
});

// Tratadores de erro melhorados
client.on("auth_failure", (msg) => {
  console.error("❌ Falha de autenticação:", msg);
  process.exit(1);
});

client.on("disconnected", (reason) => {
  console.error("🔌 Desconectado:", reason);
  if (reason === "LOGOUT") {
    console.log("📱 WhatsApp foi desconectado manualmente");
    console.log("💡 Reinicie o bot para gerar novo QR code");
    process.exit(0);
  } else {
    console.log("🔄 Tentando reconectar...");
    setTimeout(() => {
      client.initialize().catch(console.error);
    }, 5000);
  }
});

// Tratamento global de erros
process.on("unhandledRejection", (error, promise) => {
  if (
    error.message.includes("EBUSY") ||
    error.message.includes("resource busy")
  ) {
    console.log("⚠️ Arquivo de sessão em uso - isso é normal durante logout");
    return;
  }
  console.error("❌ Erro não tratado:", error);
  console.error("Promise:", promise);
});

process.on("uncaughtException", (error) => {
  if (
    error.message.includes("EBUSY") ||
    error.message.includes("resource busy")
  ) {
    console.log("⚠️ Arquivo bloqueado - reiniciando...");
    process.exit(0);
  }
  console.error("❌ Exceção não capturada:", error);
  process.exit(1);
});

// Limpeza ao sair
process.on("SIGINT", () => {
  console.log("\n🛑 Parando bot...");
  client
    .destroy()
    .then(() => {
      console.log("✅ Bot finalizado");
      process.exit(0);
    })
    .catch(() => process.exit(0));
});
