const fs = require('fs');
const path = require('path');

const MAX_TEXT_LENGTH = 80000; // ~80k caracteres por arquivo

class FileProcessor {

    /**
     * Extrai conteúdo de qualquer arquivo fazendo análise profunda.
     * Retorna { type: 'text'|'image', content: string, base64?: string }
     */
    async extractContent(filePath, originalName, mimeType) {
        const ext = path.extname(originalName).toLowerCase();

        try {
            // Texto puro / código fonte / dados
            if (this.isTextFile(ext, mimeType)) {
                return { type: 'text', content: this.readTextFile(filePath, originalName) };
            }

            // PDF
            if (ext === '.pdf' || mimeType === 'application/pdf') {
                return { type: 'text', content: await this.readPDF(filePath, originalName) };
            }

            // Word .docx
            if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                return { type: 'text', content: await this.readDocx(filePath, originalName) };
            }

            // Excel .xlsx / .xls
            if (['.xlsx', '.xls'].includes(ext) || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
                return { type: 'text', content: this.readExcel(filePath, originalName) };
            }

            // CSV (cobre o caso não detectado como text/csv)
            if (ext === '.csv') {
                return { type: 'text', content: this.readTextFile(filePath, originalName) };
            }

            // ZIP
            if (ext === '.zip' || mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') {
                return { type: 'text', content: this.readZip(filePath, originalName) };
            }

            // Imagens
            if (this.isImage(ext, mimeType)) {
                return this.readImage(filePath, originalName);
            }

            // Arquivo desconhecido — tenta ler como texto mesmo assim
            try {
                const raw = fs.readFileSync(filePath, 'utf8');
                if (raw && raw.length > 0) {
                    return { type: 'text', content: this.truncate(`[Arquivo: ${originalName}]\n\n${raw}`, originalName) };
                }
            } catch (_) {}

            return {
                type: 'text',
                content: `[Arquivo: ${originalName}]\nTipo: ${mimeType || ext || 'desconhecido'}\nTamanho: ${this.fileSize(filePath)}\nNão foi possível extrair o conteúdo deste formato, mas o arquivo foi recebido com sucesso.`
            };

        } catch (err) {
            return { type: 'text', content: `[Erro ao processar ${originalName}]: ${err.message}` };
        }
    }

    // ──────────────────────────────────────────────
    // Texto / Código Fonte
    // ──────────────────────────────────────────────
    readTextFile(filePath, originalName) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const lines = raw.split('\n').length;
        const ext = path.extname(originalName).toLowerCase();
        const lang = this.detectLanguage(ext);
        const header = `[📄 ${originalName} — ${lines} linhas, ${raw.length} caracteres${lang ? ` | ${lang}` : ''}]`;
        return this.truncate(`${header}\n\n${raw}`, originalName);
    }

    // ──────────────────────────────────────────────
    // PDF
    // ──────────────────────────────────────────────
    async readPDF(filePath, originalName) {
        const pdfParse = require('pdf-parse');
        const buf = fs.readFileSync(filePath);
        const data = await pdfParse(buf);
        const header = `[📑 ${originalName} — ${data.numpages} página(s)]`;
        return this.truncate(`${header}\n\n${data.text}`, originalName);
    }

    // ──────────────────────────────────────────────
    // Word (.docx)
    // ──────────────────────────────────────────────
    async readDocx(filePath, originalName) {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        const header = `[📝 ${originalName} — Documento Word]`;
        return this.truncate(`${header}\n\n${result.value}`, originalName);
    }

    // ──────────────────────────────────────────────
    // Excel (.xlsx, .xls)
    // ──────────────────────────────────────────────
    readExcel(filePath, originalName) {
        const XLSX = require('xlsx');
        const wb = XLSX.readFile(filePath);
        let out = `[📊 ${originalName} — Planilha Excel — ${wb.SheetNames.length} aba(s)]\n\n`;
        for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            // Converte para array de objetos para análise estruturada
            const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
            const csv = XLSX.utils.sheet_to_csv(ws);
            out += `═══ Aba: "${sheetName}" (${json.length} linhas) ═══\n${csv}\n\n`;
            if (out.length > MAX_TEXT_LENGTH) { out += '\n...[truncado]'; break; }
        }
        return this.truncate(out, originalName);
    }

    // ──────────────────────────────────────────────
    // ZIP
    // ──────────────────────────────────────────────
    readZip(filePath, originalName) {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(filePath);
        const entries = zip.getEntries();
        let out = `[🗜️ ${originalName} — ZIP com ${entries.length} arquivo(s)]\n\n`;

        for (const entry of entries) {
            if (entry.isDirectory) {
                out += `📁 ${entry.entryName}\n`;
                continue;
            }
            const ext2 = path.extname(entry.entryName).toLowerCase();
            out += `📄 ${entry.entryName} (${this.formatBytes(entry.header.size)})\n`;

            // Extrai texto dos arquivos internos que são legíveis
            if (this.isTextFile(ext2, null) && entry.header.size < 512 * 1024) {
                try {
                    const text = entry.getData().toString('utf8');
                    out += `\`\`\`\n${text}\n\`\`\`\n\n`;
                } catch {
                    out += '   [não foi possível ler]\n\n';
                }
            } else {
                out += '   [arquivo binário]\n\n';
            }

            if (out.length > MAX_TEXT_LENGTH) { out += '\n...[truncado]'; break; }
        }
        return out;
    }

    // ──────────────────────────────────────────────
    // Imagens
    // ──────────────────────────────────────────────
    readImage(filePath, originalName) {
        const stat = fs.statSync(filePath);
        const buf = fs.readFileSync(filePath);
        const base64 = buf.toString('base64');
        const content = `[🖼️ ${originalName} — Imagem (${this.formatBytes(stat.size)})]`;
        return { type: 'image', content, base64 };
    }

    // ──────────────────────────────────────────────
    // Utilitários
    // ──────────────────────────────────────────────
    isTextFile(ext, mimeType) {
        const textExts = new Set([
            '.txt', '.md', '.markdown', '.rst',
            '.json', '.jsonl', '.ndjson',
            '.xml', '.html', '.htm', '.xhtml', '.svg',
            '.css', '.scss', '.sass', '.less',
            '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
            '.py', '.pyw', '.ipynb',
            '.java', '.kt', '.kts', '.groovy',
            '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp',
            '.cs', '.vb', '.fs',
            '.php', '.phtml',
            '.rb', '.rake', '.gemspec',
            '.go', '.rs', '.swift', '.dart', '.scala',
            '.sql', '.ddl', '.dml',
            '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
            '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env',
            '.log', '.tex', '.bib',
            '.vue', '.svelte', '.astro',
            '.graphql', '.gql', '.proto',
            '.r', '.m', '.jl', '.lua', '.pl', '.pm', '.tcl',
            '.csv', '.tsv',
            '.dockerfile', '.makefile', '.cmake',
        ]);
        if (textExts.has(ext)) return true;
        if (!ext && mimeType && mimeType.startsWith('text/')) return true;
        return false;
    }

    isImage(ext, mimeType) {
        const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico', '.tiff', '.tif', '.avif', '.heic']);
        return imageExts.has(ext) || Boolean(mimeType && mimeType.startsWith('image/'));
    }

    detectLanguage(ext) {
        const map = {
            '.py': 'Python', '.js': 'JavaScript', '.ts': 'TypeScript',
            '.java': 'Java', '.cpp': 'C++', '.c': 'C', '.cs': 'C#',
            '.go': 'Go', '.rs': 'Rust', '.rb': 'Ruby', '.php': 'PHP',
            '.swift': 'Swift', '.kt': 'Kotlin', '.scala': 'Scala',
            '.html': 'HTML', '.css': 'CSS', '.sql': 'SQL',
            '.sh': 'Shell', '.ps1': 'PowerShell', '.yaml': 'YAML',
            '.json': 'JSON', '.xml': 'XML', '.md': 'Markdown',
        };
        return map[ext] || null;
    }

    truncate(text, name) {
        if (text.length <= MAX_TEXT_LENGTH) return text;
        return text.substring(0, MAX_TEXT_LENGTH) + `\n\n...[conteúdo truncado — arquivo muito grande: ${name}]`;
    }

    fileSize(filePath) {
        try { return this.formatBytes(fs.statSync(filePath).size); } catch { return 'desconhecido'; }
    }

    formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}

module.exports = new FileProcessor();
