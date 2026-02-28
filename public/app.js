const API_BASE = '/api';

// Elementos DOM
const navBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const statusBadge = document.getElementById('txt-status');
const qrContainer = document.getElementById('qr-container');

// Navegação em Abas
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');

        // Refresh de dados se mudar de aba
        if (btn.dataset.tab === 'tab-logs') loadLogs();
        if (btn.dataset.tab === 'tab-knowledge') loadUrls();
    });
});

// 1. Conexão & Status (Polling)
async function checkStatus() {
    try {
        const res = await fetch(`${API_BASE}/status`);
        const data = await res.json();

        statusBadge.textContent = data.status;
        statusBadge.className = 'badge';

        if (data.status === 'Conectando') {
            statusBadge.classList.add('badge-warning');
            if (data.qrCode) {
                // Desenha QRCode se não houver um atualizado
                qrContainer.innerHTML = '';
                const qr = qrcode(4, 'L');
                qr.addData(data.qrCode);
                qr.make();
                qrContainer.innerHTML = qr.createImgTag(5);
            } else {
                qrContainer.innerHTML = '<p class="qr-instruction">Gerando QR Code do WhatsApp...</p>';
            }
        } else if (data.status === 'Conectado') {
            statusBadge.classList.add('badge-success');
            qrContainer.innerHTML = `
                <div class="success-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    <p class="qr-instruction" style="color:#22c55e;">Sua assistente Sol está conectada e rodando!</p>
                </div>`;
        } else {
            statusBadge.classList.add('badge-danger');
            qrContainer.innerHTML = '<p class="qr-instruction">Desconectado. Aguarde inicialização do sistema.</p>';
        }

    } catch (e) {
        console.error("Erro verificando status", e);
    }
}
// Checa status a cada 3 segundos
setInterval(checkStatus, 3000);
checkStatus();

// 2. Conhecimento (URLs)
const formUrl = document.getElementById('url-form');
const inputUrl = document.getElementById('input-url');
const urlFeedback = document.getElementById('url-feedback');
const urlsList = document.getElementById('urls-list');

async function loadUrls() {
    try {
        const res = await fetch(`${API_BASE}/urls`);
        const data = await res.json();

        urlsList.innerHTML = '';
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'url-card glass';
            div.innerHTML = `
                <h4>${item.url}</h4>
                <p>${item.snippet}</p>
                <button class="btn-danger" onclick="deleteUrl('${item.url}')">Remover Fonte</button>
            `;
            urlsList.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

formUrl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = inputUrl.value.trim();
    if (!url) return;

    document.getElementById('btn-add-url').setAttribute('disabled', 'true');
    document.getElementById('btn-add-url').innerText = 'Lendo e Indexando...';
    urlFeedback.textContent = '';
    urlFeedback.className = 'feedback';

    try {
        const res = await fetch(`${API_BASE}/urls`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await res.json();

        if (res.ok) {
            urlFeedback.textContent = 'Sucesso: ' + data.message;
            urlFeedback.classList.add('success-text');
            inputUrl.value = '';
            loadUrls();
        } else {
            urlFeedback.textContent = 'Erro: ' + data.error;
            urlFeedback.classList.add('error-text');
        }
    } catch (e) {
        urlFeedback.textContent = 'Falha crítica ao tentar adicionar URL.';
        urlFeedback.classList.add('error-text');
    } finally {
        document.getElementById('btn-add-url').removeAttribute('disabled');
        document.getElementById('btn-add-url').innerText = 'Adicionar URL';
    }
});

window.deleteUrl = async (url) => {
    if (confirm('Tem certeza que deseja remover esta base de conhecimento?')) {
        await fetch(`${API_BASE}/urls`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        loadUrls();
    }
};

// 3. Painel de Logs
const logsBody = document.getElementById('logs-body');
async function loadLogs() {
    try {
        const res = await fetch(`${API_BASE}/logs`);
        const data = await res.json();

        logsBody.innerHTML = '';
        data.forEach(log => {
            const tr = document.createElement('tr');

            // Format Data
            const d = new Date(log.timestamp);
            const dataStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();

            let tipoBadge = 'bg-gray';
            if (log.type === 'RECEBIDA') tipoBadge = 'bg-blue';
            if (log.type === 'ENVIADA') tipoBadge = 'bg-green';
            if (log.type === 'SISTEMA') tipoBadge = 'bg-yellow';

            tr.innerHTML = `
                <td>${dataStr}</td>
                <td><strong>${log.from}</strong> <br><small>▶ ${log.to}</small></td>
                <td><span class="badge ${tipoBadge}">${log.type}</span></td>
                <td><div class="log-message">${log.message}</div></td>
            `;
            logsBody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

// Iniciar tabs ocultas com display correto apos load base
loadUrls();
loadLogs();
