// leitor de qr code
const qrcode = require("qrcode-terminal");
const {
  Client,
  LocalAuth,
  Buttons,
  List,
  MessageMedia,
} = require("whatsapp-web.js");

// Configurações
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./.wwebjs_auth", // manter sessão entre deploys
  }),
  puppeteer: {
    headless: process.env.HEADLESS !== "false", // true por padrão na nuvem
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, // deixa o Puppeteer encontrar automaticamente
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
    ],
  },
});
// ID do grupo específico (será obtido quando o bot conectar)
let TARGET_GROUP_ID = null;

// serviço de leitura do qr code
client.on("qr", (qr) => {
  console.log("📱 QR CODE GERADO!");
  console.log("Escaneie este QR com seu WhatsApp:");
  qrcode.generate(qr, { small: true }); // ASCII
  console.log("\n🔗 Ou abra este link para ver o QR como imagem:");
  console.log(`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qr)}`);
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
        "Grupo não encontrado. Bot funcionará em todas as conversas."
      );
    }
  } catch (error) {
    console.error("Erro ao buscar grupo:", error);
  }
});

// Inicializa com tratamento de erro
client.initialize().catch(err => {
  console.error("❌ Erro ao inicializar cliente:", err);
  process.exit(1);
});

// Utilitário: delay
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Log de entrada no grupo
client.on("group_join", async (notification) => {
  if (TARGET_GROUP_ID && notification.chatId === TARGET_GROUP_ID) {
    console.log(`✅ Novo participante entrou no grupo!`);
  }
});

// Dica: use "message" para só processar o que chega (não o que o bot envia)
client.on("message", async (msg) => {
  // Evita processar mensagens do próprio bot, por segurança
  if (msg.fromMe) return;

  // Debug
  console.log("📨 Mensagem detectada:");
  console.log("- De:", msg.from);
  console.log("- Texto:", msg.body);
  console.log("- É grupo?", msg.from.endsWith("@g.us"));
  console.log("- TARGET_GROUP_ID:", TARGET_GROUP_ID);

  // Verificar se é do grupo alvo (se definido) ou de qualquer grupo
  const isFromTargetGroup = TARGET_GROUP_ID
    ? msg.from === TARGET_GROUP_ID
    : msg.from.endsWith("@g.us");

  console.log("- É do grupo alvo?", isFromTargetGroup);
  console.log("---");

  // Menu
  if (
    msg.body &&
    /(menu|dia|tarde|noite|oi|olá|ola)/i.test(msg.body) &&
    isFromTargetGroup
  ) {
    const chat = await msg.getChat();
    await delay(1200);
    await chat.sendStateTyping();
    await delay(1200);
    const contact = await msg.getContact();
    const firstName = (contact.pushname || "colega").split(" ")[0];

    await chat.sendMessage(
      "👋 Olá, " +
        firstName +
        "\n\n" +
        "🎓 Sou o assistente da *2° FECITAC 2025*\n\n" +
        "Como posso ajudá-lo? Digite uma das opções:\n\n" +
        "1️⃣ - Inscrição no evento\n" +
        "2️⃣ - Resumo\n" +
        "3️⃣ - Banner\n" +
        "4️⃣ - Programação Geral\n" +
        "5️⃣ - Falar com atendente"
    );
    return;
  }

  // Opção 1
  if (msg.body === "1" && isFromTargetGroup) {
    const chat = await msg.getChat();
    await delay(800);
    await chat.sendStateTyping();
    await delay(800);
    await chat.sendMessage(
      "📋 *INSCRIÇÃO NO EVENTO*\n\n" +
        "📅 Data limite: 27 de setembro de 2025\n\n" +
        "🔗 Link para inscrição:\n" +
        "https://centraldeeventos.ifc.edu.br/snctsrs-605159/"
    );
    return;
  }

  // Opção 2
  if (msg.body === "2" && isFromTargetGroup) {
    const chat = await msg.getChat();
    await delay(800);
    await chat.sendStateTyping();
    await delay(800);
    await chat.sendMessage(
      "📄 *RESUMO*\n\n" +
        "📅 Data limite: 21 de setembro de 2025\n\n" +
        "⚠️ É necessário seguir o modelo do site\n\n" +
        "🔗 Link do modelo:\n" +
        "https://docs.google.com/document/d/15L93YkbHWvodpd6EpHOn5JiouzCKY_cz/edit?tab=t.0"
    );
    return;
  }

  // Opção 3
  if (msg.body === "3" && isFromTargetGroup) {
    const chat = await msg.getChat();
    await delay(800);
    await chat.sendStateTyping();
    await delay(800);
    await chat.sendMessage(
      "🎨 *BANNER*\n\n" +
        "📅 Data limite: 17 de outubro de 2025\n\n" +
        "⚠️ Seguir modelo disponível no site\n\n" +
        "🔗 Link do modelo:\n" +
        "https://docs.google.com/presentation/d/1fGZLR708imLeZxWrYVRte2bAh3QTsfLq/edit?usp=sharing&ouid=112398617982057251666&rtpof=true&sd=true"
    );
    return;
  }

  // Opção 4
  if (msg.body === "4" && isFromTargetGroup) {
    const chat = await msg.getChat();
    await delay(800);
    await chat.sendStateTyping();
    await delay(800);
    await chat.sendMessage(
      "📅 *PROGRAMAÇÃO GERAL*\n\n" +
        "📋 Acesse a programação completa do evento:\n\n" +
        "🔗 Link da programação:\n" +
        "https://drive.google.com/drive/u/1/folders/1cw7Ru5Q_On1S19tMnhWF5uwk19qlhQzl"
    );
    return;
  }

  // Opção 5
  if (msg.body === "5" && isFromTargetGroup) {
    const chat = await msg.getChat();
    await delay(800);
    await chat.sendStateTyping();
    await delay(800);
    await chat.sendMessage(
      "👥 *ATENDIMENTO HUMANO*\n\n" +
        "📞 Aguarde: nossos atendentes irão responder o mais breve possível!\n\n" +
        "⏰ Horário de atendimento: 8h às 17h"
    );
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
  console.log("🔄 Tentando reconectar...");
});

// Tratamento global de erros
process.on("unhandledRejection", (error, promise) => {
  console.error("❌ Erro não tratado:", error);
  console.error("Promise:", promise);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Exceção não capturada:", error);
  process.exit(1);
});
