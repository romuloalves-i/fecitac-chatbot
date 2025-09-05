// leitor de qr code
const qrcode = require("qrcode-terminal");
const {
  Client,
  LocalAuth,
  Buttons,
  List,
  MessageMedia,
} = require("whatsapp-web.js");

// Configurações otimizadas
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: false, // Para desenvolvimento local
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

// ID do grupo específico (será obtido quando o bot conectar)
let TARGET_GROUP_ID = null;
// serviço de leitura do qr code
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});
// apos isso ele diz que foi tudo certo
client.on("ready", async () => {
  console.log("Tudo certo! WhatsApp conectado.");

  // Buscar o grupo específico pelo nome ou invite link
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
// E inicializa tudo
client.initialize();

const delay = (ms) => new Promise((res) => setTimeout(res, ms)); // Função que usamos para criar o delay entre uma ação e outra

// Funil

// Detectar quando alguém entra no grupo
client.on("group_join", async (notification) => {
  if (TARGET_GROUP_ID && notification.chatId === TARGET_GROUP_ID) {
    console.log(`✅ Novo participante entrou no grupo!`);
  }
});

// Detectar TODAS as mensagens (incluindo as próprias)
client.on("message_create", async (msg) => {
  // Debug - mostrar todas as mensagens recebidas
  console.log("📨 Mensagem detectada:");
  console.log("- De:", msg.from);
  console.log("- Texto:", msg.body);
  console.log("- É grupo?", msg.from.endsWith("@g.us"));
  console.log("- TARGET_GROUP_ID:", TARGET_GROUP_ID);

  // Verificar se a mensagem é do grupo específico (se definido) ou permitir grupos em geral
  const isFromTargetGroup = TARGET_GROUP_ID
    ? msg.from === TARGET_GROUP_ID
    : msg.from.endsWith("@g.us");

  console.log("- É do grupo alvo?", isFromTargetGroup);
  console.log("---");

  if (
    msg.body.match(/(menu|Menu|dia|tarde|noite|oi|Oi|Olá|olá|ola|Ola)/i) &&
    isFromTargetGroup
  ) {
    console.log("🎯 Ativando resposta do bot!");
    console.log("---");
    const chat = await msg.getChat();

    await delay(3000); //delay de 3 segundos
    await chat.sendStateTyping(); // Simulando Digitação
    await delay(3000); //Delay de 3000 milisegundos mais conhecido como 3 segundos
    const contact = await msg.getContact(); //Pegando o contato
    const name = contact.pushname; //Pegando o nome do contato
    await chat.sendMessage(
      "👋 Olá! " +
        name.split(" ")[0] +
        "\n\n" +
        "🎓 Sou o assistente da *2° FECITAC 2025*\n\n" +
        "Como posso ajudá-lo? Digite uma das opções:\n\n" +
        "1️⃣ - Inscrição no evento\n" +
        "2️⃣ - Resumo\n" +
        "3️⃣ - Banner\n" +
        "4️⃣ - Programação Geral\n" +
        "5️⃣ - Falar com atendente"
    ); //Primeira mensagem de texto
    await delay(3000); //delay de 3 segundos
    await chat.sendStateTyping(); // Simulando Digitação
    await delay(5000); //Delay de 5 segundos
  }

  if (msg.body !== null && msg.body === "1" && isFromTargetGroup) {
    const chat = await msg.getChat();

    await delay(3000); //delay de 3 segundos
    await chat.sendStateTyping(); // Simulando Digitação
    await delay(3000);
    await chat.sendMessage(
      "📋 *INSCRIÇÃO NO EVENTO*\n\n" +
        "📅 Data limite: 27 de setembro de 2025\n\n" +
        "🔗 Link para inscrição:\n" +
        "https://centraldeeventos.ifc.edu.br/snctsrs-605159/"
    );
  }

  if (msg.body !== null && msg.body === "2" && isFromTargetGroup) {
    const chat = await msg.getChat();

    await delay(3000); //Delay de 3000 milisegundos mais conhecido como 3 segundos
    await chat.sendStateTyping(); // Simulando Digitação
    await delay(3000);
    await chat.sendMessage(
      "📄 *RESUMO*\n\n" +
        "📅 Data limite: 21 de setembro de 2025\n\n" +
        "⚠️ É necessário seguir o modelo do site\n\n" +
        "🔗 Link do modelo:\n" +
        "https://docs.google.com/document/d/15L93YkbHWvodpd6EpHOn5JiouzCKY_cz/edit?tab=t.0"
    );
  }

  if (msg.body !== null && msg.body === "3" && isFromTargetGroup) {
    const chat = await msg.getChat();

    await delay(3000); //Delay de 3000 milisegundos mais conhecido como 3 segundos
    await chat.sendStateTyping(); // Simulando Digitação
    await delay(3000);
    await chat.sendMessage(
      "🎨 *BANNER*\n\n" +
        "📅 Data limite: 17 de outubro de 2025\n\n" +
        "⚠️ Seguir modelo disponível no site\n\n" +
        "🔗 Link do modelo:\n" +
        "https://docs.google.com/presentation/d/1fGZLR708imLeZxWrYVRte2bAh3QTsfLq/edit?usp=sharing&ouid=112398617982057251666&rtpof=true&sd=true"
    );
  }

  if (msg.body !== null && msg.body === "4" && isFromTargetGroup) {
    const chat = await msg.getChat();

    await delay(3000); //Delay de 3000 milisegundos mais conhecido como 3 segundos
    await chat.sendStateTyping(); // Simulando Digitação
    await delay(3000);
    await chat.sendMessage(
      "📅 *PROGRAMAÇÃO GERAL*\n\n" +
        "📋 Acesse a programação completa do evento:\n\n" +
        "🔗 Link da programação:\n" +
        "https://drive.google.com/drive/u/1/folders/1cw7Ru5Q_On1S19tMnhWF5uwk19qlhQzl"
    );
  }

  if (msg.body !== null && msg.body === "5" && isFromTargetGroup) {
    const chat = await msg.getChat();

    await delay(3000); //Delay de 3000 milisegundos mais conhecido como 3 segundos
    await chat.sendStateTyping(); // Simulando Digitação
    await delay(3000);
    await chat.sendMessage(
      "👥 *ATENDIMENTO HUMANO*\n\n" +
        "📞 Aguarde nossos atendentes irão responder o mais breve possível!\n\n" +
        "⏰ Horário de atendimento: 8h às 17h"
    );
  }
});
