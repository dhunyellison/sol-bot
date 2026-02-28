const axios = require('axios');
const cheerio = require('cheerio');
const db = require('./database'); // acessará o banco JSON

async function scrapeURL(url) {
    try {
        console.log(`Buscando URL: ${url}`);
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000 // 10s
        });

        const $ = cheerio.load(data);

        // Remove lixo
        $('script, style, noscript, nav, footer, iframe, img, svg').remove();

        // Pega texto limpo
        const textContext = $('body').text().replace(/\s+/g, ' ').trim();

        if (textContext) {
            // Tenta salvar, pode falhar se já tiver 3 URLs. O próprio banco cuida disso.
            const result = db.addUrlContent(url, textContext.substring(0, 10000)); // Limitamos 10 mil chars por site p/ nao estourar a API do Gemini
            if (result) {
                console.log(`Conteúdo da URL ${url} raspado e salvo com sucesso.`);
                return { success: true, message: `O conteúdo da página foi lido e salvo na base de dados.` };
            } else {
                return { success: false, message: `Limite de 3 URLs atingido. Remova uma antes de continuar.` };
            }
        } else {
            return { success: false, message: `Não foi possível extrair texto legível desta página.` };
        }
    } catch (error) {
        console.error(`Erro ao ler URL ${url}:`, error.message);
        return { success: false, message: `Falha ao ler a URL. Erro: ${error.message}` };
    }
}

module.exports = { scrapeURL };
