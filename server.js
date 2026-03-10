require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { initDatabase, userDB, conversationDB, messageDB, fileDB } = require('./database');
const jotaAI = require('./ai-engine');
const fileProcessor = require('./file-processor');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Criar pasta de uploads
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Configurar multer (qualquer tipo de arquivo, até 500MB)
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${unique}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500 MB
});

// Inicializar MySQL antes de servir requisições
initDatabase().catch((error) => {
    console.error('Falha ao inicializar banco MySQL:', error);
    process.exit(1);
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'jota-ia-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Mude para true se usar HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Middleware de autenticação
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Não autenticado' });
    }
}

// ROTAS DE AUTENTICAÇÃO
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username e password são obrigatórios' });
    }

    try {
        const user = await userDB.findByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const match = await userDB.verifyPassword(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ success: true, username: user.username });
    } catch (err) {
        return res.status(500).json({ error: 'Erro no servidor' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/user', isAuthenticated, (req, res) => {
    res.json({ 
        userId: req.session.userId,
        username: req.session.username 
    });
});

// ROTA DE UPLOAD DE ARQUIVOS
app.post('/api/upload', isAuthenticated, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { originalname, mimetype, size, path: filePath, filename } = req.file;

    try {
        // Extrair conteúdo profundo do arquivo
        const extracted = await fileProcessor.extractContent(filePath, originalname, mimetype);

        const isImage = extracted.type === 'image';
        const extractedContent = isImage ? extracted.content : extracted.content;

        // Salvar no banco
        const fileId = await fileDB.create(
            req.session.userId,
            originalname,
            mimetype,
            size,
            filename, // guarda só o nome gerado, não o path absoluto
            extractedContent,
            isImage
        );

        res.json({
            success: true,
            fileId,
            originalName: originalname,
            mimeType: mimetype,
            size,
            isImage,
            // Envia base64 ao frontend só se for imagem (para preview)
            preview: isImage ? `data:${mimetype};base64,${extracted.base64}` : null
        });

    } catch (err) {
        console.error('Erro no upload:', err);
        // Remover arquivo deixado para trás em caso de erro
        try { fs.unlinkSync(filePath); } catch (_) {}
        res.status(500).json({ error: 'Erro ao processar o arquivo', details: err.message });
    }
});

// ROTA: servir imagem pelo fileId
app.get('/api/files/:id/image', isAuthenticated, async (req, res) => {
    const file = await fileDB.findById(req.params.id, req.session.userId);
    if (!file || !file.is_image) return res.status(404).json({ error: 'Não encontrado' });
    const filePath = path.join(UPLOADS_DIR, file.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo removido' });
    res.setHeader('Content-Type', file.mime_type);
    res.sendFile(filePath);
});

// ROTAS DE CONVERSAS
app.get('/api/conversations', isAuthenticated, async (req, res) => {
    try {
        const conversations = await conversationDB.getAllByUser(req.session.userId);
        res.json(conversations);
    } catch (err) {
        return res.status(500).json({ error: 'Erro ao buscar conversas' });
    }
});

app.post('/api/conversations', isAuthenticated, async (req, res) => {
    const { title } = req.body;

    try {
        const conversationId = await conversationDB.create(req.session.userId, title);
        res.json({ success: true, conversationId });
    } catch (err) {
        return res.status(500).json({ error: 'Erro ao criar conversa' });
    }
});

app.delete('/api/conversations/:id', isAuthenticated, async (req, res) => {
    const conversationId = req.params.id;

    try {
        await messageDB.deleteByConversation(conversationId);
        await conversationDB.delete(conversationId, req.session.userId);
        res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: 'Erro ao deletar conversa' });
    }
});

// ROTAS DE MENSAGENS
app.get('/api/conversations/:id/messages', isAuthenticated, async (req, res) => {
    const conversationId = req.params.id;

    try {
        const messages = await messageDB.getAllByConversation(conversationId);
        res.json(messages);
    } catch (err) {
        return res.status(500).json({ error: 'Erro ao buscar mensagens' });
    }
});

app.post('/api/chat', isAuthenticated, async (req, res) => {
    const { message, conversationId, fileId } = req.body;

    if (!message && !fileId) {
        return res.status(400).json({ error: 'Mensagem ou arquivo é obrigatório' });
    }

    const userMessage = message || '';

    try {
        // Carregar dados do arquivo se existir
        let fileData = null;
        if (fileId) {
            fileData = await fileDB.findById(fileId, req.session.userId);
        }

        // Texto que será salvo como mensagem do usuário
        const savedMessage = fileData
            ? `[📎 ${fileData.original_name}]\n${userMessage}`
            : userMessage;

        await messageDB.create(conversationId, 'user', savedMessage, fileId || null);
        const history = await messageDB.getAllByConversation(conversationId);

        // Montar contexto para a IA (sem duplicar o arquivo em cada mensagem do histórico)
        const apiMessages = history.slice(0, -1).map((msg) => ({
            role: msg.role,
            content: msg.content
        }));

        // Última mensagem: se tem arquivo injetamos o conteúdo extraído
        let lastUserContent = userMessage;
        let imageBase64 = null;

        if (fileData) {
            if (fileData.is_image) {
                // Lê base64 do arquivo em disco para enviar ao modelo de visão
                const filePath = path.join(UPLOADS_DIR, fileData.file_path);
                try {
                    imageBase64 = fs.readFileSync(filePath).toString('base64');
                } catch (_) {}
                lastUserContent = userMessage
                    ? `${userMessage}\n\n[Imagem enviada: ${fileData.original_name}]`
                    : `Analise esta imagem: ${fileData.original_name}`;
            } else {
                lastUserContent =
                    `O usuário enviou o arquivo "${fileData.original_name}" e pediu: ${userMessage || 'análise completa do arquivo'}\n\n` +
                    `══════ CONTEÚDO DO ARQUIVO ══════\n${fileData.extracted_content}\n═════════════════════════════════`;
            }
        }

        apiMessages.push({ role: 'user', content: lastUserContent });

        const aiResponse = await jotaAI.generateResponse(apiMessages, imageBase64);

        await messageDB.create(conversationId, 'assistant', aiResponse);
        await conversationDB.updateTimestamp(conversationId);

        res.json({ response: aiResponse });
    } catch (error) {
        console.error('Erro no chat:', error);
        res.status(500).json({
            error: 'Erro ao processar resposta da IA',
            details: error.message
        });
    }
});

// Servir páginas HTML
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.sendFile(path.join(__dirname, 'public', 'chat.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

app.get('/chat', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// --- HTTPS CONFIG ---
const sslPath = path.join(__dirname, 'ssl');
const sslOptions = {
    key: fs.existsSync(path.join(sslPath, 'server.key')) ? fs.readFileSync(path.join(sslPath, 'server.key')) : undefined,
    cert: fs.existsSync(path.join(sslPath, 'server.crt')) ? fs.readFileSync(path.join(sslPath, 'server.crt')) : undefined
};

// --- Redireciona HTTP para HTTPS ---
app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        return next();
    }
    return res.redirect('https://' + req.headers.host + req.url);
});

// --- Inicializa HTTPS se certificado existir ---
if (sslOptions.key && sslOptions.cert) {
    https.createServer(sslOptions, app).listen(PORT, () => {
        console.log(`\n✓ HTTPS rodando em https://localhost:${PORT}`);
    });
} else {
    app.listen(PORT, () => {
        console.log(`\n✓ Servidor rodando em http://localhost:${PORT}`);
        console.log('⚠️ Certificado SSL não encontrado. HTTPS desativado.');
    });
}
