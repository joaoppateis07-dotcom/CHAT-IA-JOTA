// Global state
let currentConversationId = null;
let currentUser = null;
let pendingFile = null; // { fileId, name, size, mimeType, isImage, preview }

// Elements
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const newChatBtn = document.getElementById('new-chat-btn');
const conversationsList = document.getElementById('conversations-list');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const logoutBtn = document.getElementById('logout-btn');
const welcomeScreen = document.getElementById('welcome-screen');
const chatContainer = document.getElementById('chat-container');
const charCount = document.getElementById('char-count');
const fileInput = document.getElementById('file-input');
const attachBtn = document.getElementById('attach-btn');
const dropOverlay = document.getElementById('drop-overlay');
const filePreviewArea = document.getElementById('file-preview-area');
const filePreviewCard = document.getElementById('file-preview-card');
const filePreviewIcon = document.getElementById('file-preview-icon');
const filePreviewName = document.getElementById('file-preview-name');
const filePreviewSize = document.getElementById('file-preview-size');
const fileRemoveBtn = document.getElementById('file-remove-btn');
const fileUploadProgress = document.getElementById('file-upload-progress');

// Initialize
init();

async function init() {
    await loadUser();
    await loadConversations();
    setupEventListeners();
    setupFileHandlers();
    autoResizeTextarea();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FILE HANDLING
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function setupFileHandlers() {
    // Clique no botÃ£o de anexar
    attachBtn.addEventListener('click', () => fileInput.click());

    // SeleÃ§Ã£o pelo input
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) handleFile(fileInput.files[0]);
        fileInput.value = ''; // reset so same file can be selected again
    });

    // Remover arquivo
    fileRemoveBtn.addEventListener('click', clearPendingFile);

    // â”€â”€ DRAG & DROP em toda a janela â”€â”€
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        dropOverlay.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            dropOverlay.classList.remove('active');
        }
    });

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        dropOverlay.classList.remove('active');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFile(files[0]);
    });

    // â”€â”€ PASTE (Ctrl+V imagem ou arquivo) â”€â”€
    document.addEventListener('paste', (e) => {
        const items = Array.from(e.clipboardData.items);
        const fileItem = items.find(item => item.kind === 'file');
        if (fileItem) {
            e.preventDefault();
            const file = fileItem.getAsFile();
            if (file) handleFile(file);
        }
    });
}

// Processar qualquer arquivo recebido
async function handleFile(file) {
    showUploadProgress(`Processando "${file.name}"...`);
    showPreviewCard(file);

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Erro no upload');

        pendingFile = {
            fileId: data.fileId,
            name: data.originalName,
            size: data.size,
            mimeType: data.mimeType,
            isImage: data.isImage,
            preview: data.preview
        };

        hideUploadProgress();

        // Atualiza preview
        filePreviewIcon.textContent = getFileIcon(data.mimeType, data.originalName);
        filePreviewName.textContent = data.originalName;
        filePreviewSize.textContent = formatBytes(data.size) + ' Â· Pronto para enviar';

        // Se for imagem, mostra miniatura
        if (data.isImage && data.preview) {
            const img = document.createElement('img');
            img.src = data.preview;
            img.className = 'file-thumb';
            img.style.cssText = 'width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--border-color)';
            filePreviewIcon.replaceWith(img);
            img.id = 'file-preview-icon';
        }

        messageInput.focus();

    } catch (err) {
        hideUploadProgress();
        clearPendingFile();
        showError('Erro ao processar arquivo: ' + err.message);
    }
}

function showPreviewCard(file) {
    filePreviewIcon.textContent = getFileIcon(file.type, file.name);
    filePreviewName.textContent = file.name;
    filePreviewSize.textContent = formatBytes(file.size) + ' Â· Enviando...';
    filePreviewArea.style.display = 'block';
    filePreviewCard.style.display = 'flex';
}

function showUploadProgress(text) {
    fileUploadProgress.classList.add('active');
    fileUploadProgress.querySelector('.progress-text').textContent = text;
}

function hideUploadProgress() {
    fileUploadProgress.classList.remove('active');
}

function clearPendingFile() {
    pendingFile = null;
    filePreviewArea.style.display = 'none';
    filePreviewCard.style.display = 'none';
    hideUploadProgress();
    // restaura Ã­cone
    const existing = document.getElementById('file-preview-icon');
    if (existing && existing.tagName === 'IMG') {
        const span = document.createElement('div');
        span.id = 'file-preview-icon';
        span.className = 'file-preview-icon';
        span.textContent = 'ðŸ“„';
        existing.replaceWith(span);
    }
}

function getFileIcon(mimeType, name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    if (mimeType && mimeType.startsWith('image/')) return 'ðŸ–¼ï¸';
    if (mimeType === 'application/pdf' || ext === 'pdf') return 'ðŸ“‘';
    if (ext === 'docx' || ext === 'doc') return 'ðŸ“';
    if (ext === 'xlsx' || ext === 'xls') return 'ðŸ“Š';
    if (ext === 'csv') return 'ðŸ“‹';
    if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'ðŸ—œï¸';
    if (['js','ts','py','java','cpp','c','go','rs','php','rb'].includes(ext)) return 'ðŸ’»';
    if (['json','xml','yaml','yml'].includes(ext)) return 'âš™ï¸';
    if (['mp3','mp4','wav','avi','mov'].includes(ext)) return 'ðŸŽ¬';
    return 'ðŸ“„';
}

function formatBytes(bytes) {
    if (!bytes) return '?';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showError(msg) {
    const errDiv = document.createElement('div');
    errDiv.style.cssText = 'color:var(--error);font-size:13px;padding:8px 16px;text-align:center';
    errDiv.textContent = msg;
    messagesContainer.appendChild(errDiv);
    setTimeout(() => errDiv.remove(), 5000);
    scrollToBottom();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// USER / CONVERSATIONS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function loadUser() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            currentUser = await response.json();
            document.getElementById('username').textContent = currentUser.username;
            document.getElementById('user-initial').textContent = currentUser.username[0].toUpperCase();
        } else {
            window.location.href = '/';
        }
    } catch (error) {
        window.location.href = '/';
    }
}

async function loadConversations() {
    try {
        const response = await fetch('/api/conversations');
        if (response.ok) {
            const conversations = await response.json();
            renderConversations(conversations);
        }
    } catch (error) {
        console.error('Erro ao carregar conversas:', error);
    }
}

function renderConversations(conversations) {
    conversationsList.innerHTML = '';

    if (conversations.length === 0) {
        conversationsList.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-tertiary);">
                <p>Nenhuma conversa ainda</p>
                <p style="font-size: 12px; margin-top: 5px;">Clique em "Nova Conversa" para comeÃ§ar</p>
            </div>
        `;
        return;
    }

    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        if (conv.id === currentConversationId) item.classList.add('active');

        const date = new Date(conv.updated_at);
        item.innerHTML = `
            <div class="conversation-title">${escapeHtml(conv.title)}</div>
            <div class="conversation-date">${formatDate(date)}</div>
        `;
        item.addEventListener('click', () => loadConversation(conv.id, item));
        conversationsList.appendChild(item);
    });
}

function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Hoje';
    if (days === 1) return 'Ontem';
    if (days < 7) return `${days} dias atrÃ¡s`;
    return date.toLocaleDateString('pt-BR');
}

async function loadConversation(conversationId, element) {
    currentConversationId = conversationId;
    try {
        const response = await fetch(`/api/conversations/${conversationId}/messages`);
        if (response.ok) {
            const messages = await response.json();
            renderMessages(messages);
            document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
            element && element.classList.add('active');
        }
    } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
    }
}

function renderMessages(messages) {
    welcomeScreen.style.display = 'none';
    messagesContainer.innerHTML = '';
    messages.forEach(msg => addMessageToUI(msg.role, msg.content, msg.created_at));
    scrollToBottom();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MENSAGENS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function addMessageToUI(role, content, timestamp = new Date()) {
    const message = document.createElement('div');
    message.className = `message ${role}`;

    const time = new Date(timestamp);
    const formattedTime = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const avatar = role === 'user' ? 'ðŸ‘¤' : 'ðŸ¤–';
    const author = role === 'user' ? currentUser.username : 'Jota IA';

    // Detecta se a mensagem tem arquivo anexado
    const fileMatch = content.match(/^\[ðŸ“Ž (.+?)\]\n?([\s\S]*)/);
    let fileHtml = '';
    let mainContent = content;

    if (fileMatch) {
        const fileName = fileMatch[1];
        const rest = fileMatch[2] || '';
        const icon = getFileIcon('', fileName);
        fileHtml = `
            <div class="message-file-attachment">
                <span class="attachment-icon">${icon}</span>
                <span class="attachment-name">${escapeHtml(fileName)}</span>
            </div>`;
        mainContent = rest.trim();
    }

    message.innerHTML = `
        <div class="message-header">
            <div class="message-avatar">${avatar}</div>
            <div class="message-author">${escapeHtml(author)}</div>
            <div class="message-time">${formattedTime}</div>
        </div>
        <div class="message-content">${fileHtml}${formatMessage(mainContent)}</div>
    `;

    messagesContainer.appendChild(message);
    welcomeScreen.style.display = 'none';
    scrollToBottom();
}

function formatMessage(text) {
    if (!text) return '';
    // blocos de cÃ³digo
    text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) =>
        `<pre><code${lang ? ` class="lang-${lang}"` : ''}>${escapeHtml(code.trim())}</code></pre>`
    );
    // inline code
    text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);
    // negrito
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // itÃ¡lico
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // quebras de linha
    text = text.replace(/\n/g, '<br>');
    return text;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message assistant';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = `
        <div class="message-header">
            <div class="message-avatar">ðŸ¤–</div>
            <div class="message-author">Jota IA</div>
        </div>
        <div class="typing-indicator">
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
            <span style="font-size:13px;color:var(--text-tertiary);margin-left:8px">Analisando${pendingFile ? ' arquivo' : ''}...</span>
        </div>
    `;
    messagesContainer.appendChild(indicator);
    scrollToBottom();
}

function removeTypingIndicator() {
    document.getElementById('typing-indicator')?.remove();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ENVIO DE MENSAGEM
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message && !pendingFile) return;

    if (!currentConversationId) await createNewConversation();
    if (!currentConversationId) return;

    // Mostrar mensagem do usuÃ¡rio (com arquivo se houver)
    const displayContent = pendingFile
        ? `[ðŸ“Ž ${pendingFile.name}]\n${message}`
        : message;

    addMessageToUI('user', displayContent);

    const fileIdToSend = pendingFile ? pendingFile.fileId : null;

    // Limpa estado
    messageInput.value = '';
    messageInput.style.height = 'auto';
    updateCharCount();
    clearPendingFile();

    messageInput.disabled = true;
    sendBtn.disabled = true;
    showTypingIndicator();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                conversationId: currentConversationId,
                fileId: fileIdToSend
            })
        });

        const data = await response.json();
        removeTypingIndicator();

        if (response.ok) {
            addMessageToUI('assistant', data.response);
            await loadConversations();
        } else {
            addMessageToUI('assistant', `âŒ Erro: ${data.error || 'NÃ£o foi possÃ­vel processar sua mensagem.'}`);
        }
    } catch (error) {
        removeTypingIndicator();
        addMessageToUI('assistant', 'âŒ Erro: NÃ£o foi possÃ­vel conectar ao servidor.');
    } finally {
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

async function createNewConversation() {
    try {
        const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Nova Conversa' })
        });
        if (response.ok) {
            const data = await response.json();
            currentConversationId = data.conversationId;
            messagesContainer.innerHTML = '';
            welcomeScreen.style.display = 'none';
            await loadConversations();
        }
    } catch (error) {
        console.error('Erro ao criar conversa:', error);
    }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// UTILITÃRIOS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function autoResizeTextarea() {
    messageInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        updateCharCount();
    });
}

function updateCharCount() {
    charCount.textContent = `${messageInput.value.length} caracteres`;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// EVENT LISTENERS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function setupEventListeners() {
    sendBtn.addEventListener('click', sendMessage);

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    newChatBtn.addEventListener('click', async () => {
        currentConversationId = null;
        messagesContainer.innerHTML = '';
        welcomeScreen.style.display = 'block';
        clearPendingFile();
        messageInput.focus();
    });

    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });

    logoutBtn.addEventListener('click', async () => {
        if (confirm('Deseja realmente sair?')) {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/';
        }
    });

    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            messageInput.value = chip.textContent;
            messageInput.focus();
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
            updateCharCount();
        });
    });

    if (window.innerWidth <= 768) {
        conversationsList.addEventListener('click', () => sidebar.classList.remove('active'));
    }
}

// Focus no inÃ­cio
messageInput.focus();
