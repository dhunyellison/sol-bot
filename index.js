require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { exec } = require('child_process');
const server = require('./server');
const db = require('./database');
const { buildPrompt } = require('./prompt');
const { sleep, splitMessage, downloadAndSaveAudio } = require('./utils');
const fs = require('fs');

// Configs
const ADMIN_NUMBERS = process.env.ADMIN_NUMBERS ? process.env.ADMIN_NUMBERS.split(',').map(n => n.trim() + '@c.us') : [];
const ALERT_COMMAND = process.env.ALERT_COMMAND || "echo Atendimento Humano Solicitado";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Inicializa o Web Server do Painel
server.startServer();

const isProducao = process.env.NODE_ENV === 'production';

// Inicializa WhatsApp Client
console.log('Iniciando cliente do WhatsApp...');
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

client.on('qr', (qr) => {
    db.setQrCode(qr);
    db.setStatus('Conectando');
    console.log('QR Code recebido. Leia com o aplicativo WhatsApp (ou acesse o Painel Web).');
    qrcodeTerminal.generate(qr, { small: true });
});

client.on('ready', () => {
    db.setQrCode(null);
    db.setStatus('Conectado');
    console.log('Sol está online e conectada ao WhatsApp!');
});

client.on('disconnected', (reason) => {
    db.setQrCode(null);
    db.setStatus('Desconectado');
    console.log('Sol desconectou do WhatsApp:', reason);
});

// Listener Principal de Mensagens
client.on('message', async (msg) => {
    try {
        const contact = await msg.getContact();
        const numberId = contact.id._serialized;
        const bodyStr = msg.body || '';

        // Ignora status e grupos 
        if (msg.isStatus || contact.isGroup) return;

        // --- LÓGICA DE ADMIN: SALVAR ÁUDIO ---
        if (ADMIN_NUMBERS.includes(numberId) && bodyStr.startsWith('!salvar_audio')) {
            const parts = bodyStr.split(' ');
            if (parts.length < 2) {
                await msg.reply('Formato incorreto. Use: !salvar_audio <nome_do_áudio>');
                return;
            }
            const audioName = parts[1].toLowerCase();
            const resultMsg = await downloadAndSaveAudio(msg, audioName);
            db.addLog(contact.name || contact.number, 'Sol', 'SISTEMA', `Salvar Áudio: ${audioName}`);
            await msg.reply(resultMsg);
            return;
        }

        // --- FLUXO DE CLIENTES COMUNS ---
        db.addLog(contact.name || contact.number, 'Sol', 'RECEBIDA', bodyStr);

        // Se o cliente tá na fila de atendimento humano, não responde
        if (db.isWaitingHumanHelp(numberId)) {
            console.log(`[IGNORANDO] ${contact.number} está recebendo atendimento humano.`);
            return;
        }

        // Simula tempo "Lendo" a mensagem
        await sleep(Math.floor(Math.random() * 2000) + 1000); // 1 a 3 segundos

        // IA Gerando a resposta
        const promptSystem = buildPrompt();
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: promptSystem }] },
                { role: "model", parts: [{ text: "Entendido. Serei a Sol, só respondo em pt-BR usando os dados do banco lidos e aciono as tags designadas de áudios." }] }
            ]
        });

        // Chat send WhatsApp msg format
        const responseAI = await chat.sendMessage(bodyStr);
        let iaReply = responseAI.response.text();

        // Verifica Gatilho Humano
        if (iaReply.includes('[ATENDIMENTO HUMANO]')) {
            db.addToHumanHelp(numberId);

            // Mensagem de Transbordo
            const fallbackText = "Certo, entendi! Vou te transferir para um de nossos atendentes humanos dar continuidade à sua dúvida. Só um momentinho! 🏖️🏃‍♀️";

            const chatGroup = await msg.getChat();
            await chatGroup.sendStateTyping();
            await sleep(2000);
            await client.sendMessage(numberId, fallbackText);
            db.addLog('Sol', contact.name || contact.number, 'ENVIADA', fallbackText);

            // Notifica os admins
            for (const admin of ADMIN_NUMBERS) {
                const alertaMsg = `🚨 *SOL INFORMA:* O cliente *${contact.name || contact.number}* solicitou Atendimento Humano.\nAcesse a conversa dele no WhatsApp para ajudar.`;
                await client.sendMessage(admin, alertaMsg);
            }

            // Executa comando de sistema (som, alerta na tela, etc)
            exec(ALERT_COMMAND, (err) => {
                if (err) console.error("Erro ao executar comando de alerta:", err);
            });

            db.addLog('Sol', 'Sistema', 'SISTEMA', 'Atendimento humano transferido e administradores notificados.');
            return;
        }

        // Lógica de Resposta Normal
        const partsToSend = splitMessage(iaReply);
        const chatGroup = await msg.getChat();

        for (const part of partsToSend) {
            // Verifica Tag de Áudio `[AUDIO:nome]`
            const audioMatch = part.match(/\[AUDIO:([^\]]+)\]/);

            if (audioMatch) {
                const audioName = audioMatch[1].toLowerCase();
                const audiosMap = db.getAudioMapping();
                const cleanText = part.replace(audioMatch[0], '').trim();

                // Se tinha texto com a tag, envia o texto antes
                if (cleanText) {
                    await chatGroup.sendStateTyping();
                    await sleep(cleanText.length * 40);
                    await client.sendMessage(numberId, cleanText);
                    db.addLog('Sol', contact.name || contact.number, 'ENVIADA', cleanText);
                }

                // Envia o aúdio usando WWebjs e o status de Gravação fake!
                if (audiosMap[audioName] && fs.existsSync(audiosMap[audioName])) {
                    await chatGroup.sendStateRecording();
                    await sleep(4000); // 4 seg gravando
                    const media = MessageMedia.fromFilePath(audiosMap[audioName]);
                    await client.sendMessage(numberId, media, { sendAudioAsVoice: true });
                    db.addLog('Sol', contact.name || contact.number, 'ENVIADA', `[Voice Áudio: ${audioName}]`);
                }
            } else {
                // Envio de Texto Padrão com Humanização
                await chatGroup.sendStateTyping();

                // Simula digitação: tempo base de 1,5s + (30ms por caractere)
                const typingTime = 1500 + (part.length * 30);
                await sleep(typingTime);

                await client.sendMessage(numberId, part);
                db.addLog('Sol', contact.name || contact.number, 'ENVIADA', part);
            }
        }

    } catch (e) {
        console.error("Erro processando msg:", e);
    }
});

client.initialize();
