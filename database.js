const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

// Estrutura inicial do banco
let db = {
    logs: [],
    urls: [], // máximo de 3 { url, content }
    audios: {}, // { 'nome_comando': 'caminho/arquivo.ogg' }
    config: {
        qrCode: null,
        status: 'Desconectado',
        humanHelpList: [] // números que estão esperando atendimento humano
    }
};

// Carrega do disco se existir
if (fs.existsSync(DB_FILE)) {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        db = JSON.parse(data);
    } catch (e) {
        console.error("Erro ao ler db.json, usando padrao", e);
    }
}

// Salva as alterações no disco
function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

module.exports = {
    getDb: () => db,

    // Histórico / Logs
    addLog: (from, to, type, message) => {
        const timestamp = new Date().toISOString();
        db.logs.unshift({ timestamp, from, to, type, message });

        // Mantém apenas os últimos 500 logs para não pesar muito
        if (db.logs.length > 500) db.logs.pop();
        saveDB();
    },

    // QR Code / Status
    setQrCode: (qr) => {
        db.config.qrCode = qr;
        saveDB();
    },
    setStatus: (status) => {
        db.config.status = status;
        saveDB();
    },

    // Atendimento Humano
    addToHumanHelp: (number) => {
        if (!db.config.humanHelpList.includes(number)) {
            db.config.humanHelpList.push(number);
            saveDB();
        }
    },
    removeFromHumanHelp: (number) => {
        db.config.humanHelpList = db.config.humanHelpList.filter(n => n !== number);
        saveDB();
    },
    isWaitingHumanHelp: (number) => {
        return db.config.humanHelpList.includes(number);
    },

    // Áudios mapeados
    saveAudioMapping: (name, filename) => {
        db.audios[name.toLowerCase()] = filename;
        saveDB();
    },
    getAudioMapping: () => db.audios,

    // URLs de Base de Conhecimento (Máximo 3)
    addUrlContent: (url, content) => {
        // Verifica se já existe e atualiza
        const existingIndex = db.urls.findIndex(u => u.url === url);
        if (existingIndex >= 0) {
            db.urls[existingIndex].content = content;
        } else {
            // Se já tem 3, não adiciona mais
            if (db.urls.length >= 3) {
                return false; // Falha por limite
            }
            db.urls.push({ url, content });
        }
        saveDB();
        return true;
    },
    removeUrl: (url) => {
        db.urls = db.urls.filter(u => u.url !== url);
        saveDB();
    },
    getKnowledgeBase: () => {
        return db.urls.map(u => `Fonte: ${u.url}\nConteúdo: ${u.content}`).join('\n\n');
    }
};
