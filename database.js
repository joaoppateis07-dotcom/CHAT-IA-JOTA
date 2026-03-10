const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Pool de conexões MySQL
let pool;

async function initDatabase() {
    try {
        const dbName = process.env.DB_NAME || 'jota_ia';
        const baseConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };

        // Conexão temporária para garantir existência do banco
        const bootstrapConnection = await mysql.createConnection(baseConfig);
        await bootstrapConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await bootstrapConnection.end();

        // Pool principal conectado ao banco já criado
        pool = mysql.createPool({
            ...baseConfig,
            database: dbName
        });

        console.log('✓ Conectado ao MySQL');

        const connection = await pool.getConnection();

        // Criar tabelas
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_username (username)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(500) DEFAULT 'Nova Conversa',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_updated_at (updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                conversation_id INT NOT NULL,
                role ENUM('user', 'assistant', 'system') NOT NULL,
                content TEXT NOT NULL,
                file_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                INDEX idx_conversation_id (conversation_id),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS files (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                original_name VARCHAR(500) NOT NULL,
                mime_type VARCHAR(150),
                size INT,
                file_path VARCHAR(1000),
                extracted_content MEDIUMTEXT,
                is_image TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Migração segura: adiciona file_id se tabela messages já existia sem ela
        try {
            await connection.query(`
                ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_id INT NULL
            `);
        } catch (_) {}

        connection.release();
        console.log('✓ Tabelas MySQL criadas com sucesso');

    } catch (error) {
        console.error('Erro ao inicializar banco de dados MySQL:', error);
        throw error;
    }
}

// Obter pool de conexões
function getPool() {
    return pool;
}

// Funções de usuário
const userDB = {
    create: async (username, password, email) => {
        try {
            const hash = await bcrypt.hash(password, 10);
            const [result] = await pool.execute(
                'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
                [username, hash, email]
            );
            return result.insertId;
        } catch (error) {
            throw error;
        }
    },

    findByUsername: async (username) => {
        try {
            const [rows] = await pool.execute(
                'SELECT * FROM users WHERE username = ?',
                [username]
            );
            return rows[0] || null;
        } catch (error) {
            throw error;
        }
    },

    verifyPassword: async (password, hash) => {
        return await bcrypt.compare(password, hash);
    }
};

// Funções de conversas
const conversationDB = {
    create: async (userId, title) => {
        try {
            const [result] = await pool.execute(
                'INSERT INTO conversations (user_id, title) VALUES (?, ?)',
                [userId, title || 'Nova Conversa']
            );
            return result.insertId;
        } catch (error) {
            throw error;
        }
    },

    getAllByUser: async (userId) => {
        try {
            const [rows] = await pool.execute(
                'SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC',
                [userId]
            );
            return rows;
        } catch (error) {
            throw error;
        }
    },

    updateTimestamp: async (conversationId) => {
        try {
            await pool.execute(
                'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [conversationId]
            );
        } catch (error) {
            throw error;
        }
    },

    delete: async (conversationId, userId) => {
        try {
            await pool.execute(
                'DELETE FROM conversations WHERE id = ? AND user_id = ?',
                [conversationId, userId]
            );
        } catch (error) {
            throw error;
        }
    }
};

// Funções de mensagens
const messageDB = {
    create: async (conversationId, role, content, fileId = null) => {
        try {
            const [result] = await pool.execute(
                'INSERT INTO messages (conversation_id, role, content, file_id) VALUES (?, ?, ?, ?)',
                [conversationId, role, content, fileId]
            );
            return result.insertId;
        } catch (error) {
            throw error;
        }
    },

    getAllByConversation: async (conversationId) => {
        try {
            const [rows] = await pool.execute(
                'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
                [conversationId]
            );
            return rows;
        } catch (error) {
            throw error;
        }
    },

    deleteByConversation: async (conversationId) => {
        try {
            await pool.execute(
                'DELETE FROM messages WHERE conversation_id = ?',
                [conversationId]
            );
        } catch (error) {
            throw error;
        }
    }
};

module.exports = {
    initDatabase,
    getPool,
    userDB,
    conversationDB,
    messageDB,
    fileDB: {
        create: async (userId, originalName, mimeType, size, filePath, extractedContent, isImage) => {
            const [result] = await pool.execute(
                'INSERT INTO files (user_id, original_name, mime_type, size, file_path, extracted_content, is_image) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, originalName, mimeType, size, filePath, extractedContent, isImage ? 1 : 0]
            );
            return result.insertId;
        },

        findById: async (id, userId) => {
            const [rows] = await pool.execute(
                'SELECT * FROM files WHERE id = ? AND user_id = ?',
                [id, userId]
            );
            return rows[0] || null;
        },

        delete: async (id, userId) => {
            await pool.execute('DELETE FROM files WHERE id = ? AND user_id = ?', [id, userId]);
        }
    }
};
