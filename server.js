require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./database');
const { scrapeURL } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- APIs do Dashboard ----------

// 1. Status Connection & QR Code
app.get('/api/status', (req, res) => {
    const currentState = db.getDb().config;
    res.json({
        status: currentState.status,
        qrCode: currentState.status === 'Conectando' ? currentState.qrCode : null
    });
});

// 2. Obter Histórico de Conversas (limitado a 50 p/ display)
app.get('/api/logs', (req, res) => {
    const logs = db.getDb().logs.slice(0, 50);
    res.json(logs);
});

// 3. Gerenciamento de Conhecimento (URLs)
app.get('/api/urls', (req, res) => {
    const urls = db.getDb().urls.map(u => ({ url: u.url, snippet: u.content.substring(0, 50) + '...' }));
    res.json(urls);
});

app.post('/api/urls', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL é obrigatória' });

    // Dispara Scraping
    const result = await scrapeURL(url);
    if (result.success) {
        res.json({ message: result.message });
    } else {
        res.status(400).json({ error: result.message });
    }
});

app.delete('/api/urls', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL é obrigatória' });

    db.removeUrl(url);
    res.json({ message: 'URL Removida' });
});

// Rota fallback para o index
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia servidor
function startServer() {
    app.listen(PORT, () => {
        console.log(`\n\n=== PAINEL DA SOL INICIADO ===`);
        console.log(`Acesse o Dashboard: http://localhost:${PORT}\n`);
    });
}

module.exports = { startServer };
