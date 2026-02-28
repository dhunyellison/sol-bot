const fs = require('fs');
const path = require('path');
const db = require('./database');

// Atrasa a execução por 'ms' milissegundos
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Quebra um texto longo em partes menores pra não mandar um "tijolo" de uma vez
function splitMessage(text) {
    if (!text) return [];

    // Tenta quebrar por parágrafos duplos (quebras de linha)
    let parts = text.split('\n\n');

    // Se ainda for muito grande, tenta quebrar por frases/ponto final
    let finalParts = [];
    for (const part of parts) {
        if (part.length > 400) {
            // Divide conservando o ponto final usando Regex
            const sentences = part.match(/[^.!?]+[.!?]+/g) || [part];
            let currentChunk = "";
            for (const sentence of sentences) {
                if ((currentChunk.length + sentence.length) > 400) {
                    finalParts.push(currentChunk.trim());
                    currentChunk = sentence;
                } else {
                    currentChunk += " " + sentence;
                }
            }
            if (currentChunk.trim()) {
                finalParts.push(currentChunk.trim());
            }
        } else {
            if (part.trim()) finalParts.push(part.trim());
        }
    }

    return finalParts;
}

// Processa o recebimento e mapeamento de um arquivo de áudio pela mensagem do whatsapp
async function downloadAndSaveAudio(msg, audioName) {
    try {
        if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            if (quotedMsg.hasMedia) {
                const media = await quotedMsg.downloadMedia();

                // Salvar apenas se for audio
                if (media && media.mimetype.includes('audio') || media.mimetype.includes('ogg')) {
                    const fileName = `${audioName}.ogg`;
                    const filePath = path.join(__dirname, 'audios', fileName);

                    fs.writeFileSync(filePath, media.data, { encoding: 'base64' });
                    db.saveAudioMapping(audioName, filePath);

                    return `Áudio '${audioName}' salvo com sucesso! A Sol agora sabe responder enviando esse áudio.`;
                }
            }
        }
        return "Para salvar um áudio, você deve responder a uma mensagem de voz com o comando '!salvar_audio <nome>'.";
    } catch (error) {
        console.error("Erro salvando audio", error);
        return "Erro interno ao tentar salvar o áudio.";
    }
}

module.exports = { sleep, splitMessage, downloadAndSaveAudio };
