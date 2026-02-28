const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log('Iniciando o gerador de QR Code (Versão de Teste)...');
console.log('Aguarde alguns segundos enquanto o navegador invisível é aberto.');

const client = new Client({
    // Usa uma sessão separada para não interferir no bot principal
    authStrategy: new LocalAuth({ clientId: "sessao-teste" }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('\n=========================================');
    console.log('📱 LEIA O QR CODE ABAIXO COM O SEU WHATSAPP');
    console.log('=========================================\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n✅ SUCESSO TOTAL!');
    console.log('O seu WhatsApp conectou perfeitamente nesta máquina de teste.');
    console.log('Como é apenas um teste, ele não vai responder mensagens.');
    console.log('\n👉 Para fechar: Aperte CTRL + C no seu teclado duas vezes.');
});

client.on('auth_failure', msg => {
    console.error('❌ Falha na autenticação:', msg);
});

client.initialize();
