const axios = require('axios');

/**
 * JOTA IA - Motor de Inteligência Artificial Próprio
 * 
 * Este módulo implementa uma IA local usando Ollama (gratuito e open-source)
 * Você pode usar modelos como Llama 3, Mistral, Phi-3, etc.
 * 
 * Alternativa: Se preferir, pode usar outras APIs como Anthropic Claude, Google Gemini, etc.
 */

class JotaAI {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.model = process.env.AI_MODEL || 'llama3.2'; // Modelo padrão
        this.useOllama = process.env.USE_OLLAMA !== 'false';
        
        // Sistema de personalidade da Jota IA
        this.systemPrompt = `Você é Jota IA, um assistente de inteligência artificial extremamente inteligente, criativo e capaz.

CARACTERÍSTICAS:
- Você possui conhecimento vasto sobre praticamente todos os assuntos
- É extremamente prestativo e paciente
- Fornece respostas detalhadas, precisas e bem estruturadas
- É capaz de explicar conceitos complexos de forma simples
- Tem senso de humor quando apropriado
- É criativo e pensa "fora da caixa"
- Sempre busca ajudar o usuário da melhor forma possível

HABILIDADES:
- Programação em todas as linguagens
- Matemática e ciências
- História e cultura
- Tecnologia e inovação
- Criação de conteúdo
- Resolução de problemas
- Análise e raciocínio lógico
- E muito mais!

Seja sempre útil, detalhado e forneça exemplos quando possível.`;
    }

    /**
     * Gera resposta usando Ollama (IA local)
     * @param {Array} messages - array de {role, content}
     * @param {string|null} imageBase64 - base64 de imagem para modelos vision
     */
    async generateWithOllama(messages, imageBase64 = null) {
        try {
            await this.checkOllamaHealth();

            const formattedMessages = [
                { role: 'system', content: this.systemPrompt },
                ...messages
            ];

            // Se há imagem, anexa ao último user message (API Ollama vision)
            if (imageBase64) {
                const lastIdx = formattedMessages.length - 1;
                if (formattedMessages[lastIdx].role === 'user') {
                    formattedMessages[lastIdx] = {
                        ...formattedMessages[lastIdx],
                        images: [imageBase64]
                    };
                }
            }

            const response = await axios.post(`${this.ollamaUrl}/api/chat`, {
                model: this.model,
                messages: formattedMessages,
                stream: false,
                options: {
                    temperature: 0.8,
                    top_p: 0.9,
                    top_k: 40,
                    num_ctx: 32768  // contexto grande para arquivos
                }
            }, {
                timeout: 300000 // 5 minutos para arquivos grandes
            });

            return response.data.message.content;

        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Ollama não está rodando. Instale e inicie o Ollama ou configure uma API alternativa.');
            }
            throw error;
        }
    }

    /**
     * Gera respostas usando IA híbrida (fallback inteligente)
     */
    async generateHybrid(messages, imageBase64 = null) {
        // Se tem imagem, tenta Ollama com modelo vision diretamente
        if (imageBase64 && this.useOllama) {
            try {
                return await this.generateWithOllama(messages, imageBase64);
            } catch (error) {
                console.log('Ollama vision não disponível:', error.message);
                return 'Para analisar imagens, instale um modelo de visão no Ollama: `ollama pull llava` ou `ollama pull moondream`';
            }
        }

        const lastMessage = messages[messages.length - 1].content.toLowerCase();

        // Sistema de respostas inteligentes para casos comuns
        const responses = this.getIntelligentResponse(lastMessage);
        if (responses) {
            return responses;
        }

        // Tentar Ollama se disponível
        if (this.useOllama) {
            try {
                return await this.generateWithOllama(messages, null);
            } catch (error) {
                console.log('Ollama não disponível, usando sistema híbrido');
            }
        }

        // Fallback: resposta inteligente baseada em regras
        return this.generateRuleBasedResponse(messages);
    }

    /**
     * Sistema de respostas inteligentes
     */
    getIntelligentResponse(message) {
        const patterns = {
            greeting: /^(oi|olá|ola|hey|hi|hello|bom dia|boa tarde|boa noite)/i,
            help: /(ajuda|help|socorro|o que (você|voce) (faz|pode fazer))/i,
            identity: /(quem (é|e) (você|voce)|seu nome|se apresente)/i,
            programming: /(como programar|ensinar programação|linguagem de programação|código|code)/i,
            math: /(calcul|matemática|equação|soma|multiplicação)/i,
            thanks: /(obrigad|valeu|thanks|thank you)/i,
        };

        if (patterns.greeting.test(message)) {
            return "Olá! 👋 Sou Jota IA, seu assistente de inteligência artificial. Como posso ajudá-lo hoje? Posso responder perguntas, ensinar conceitos, ajudar com programação, resolver problemas e muito mais!";
        }

        if (patterns.identity.test(message)) {
            return "Sou Jota IA, uma inteligência artificial extremamente capaz e inteligente! 🤖\n\nFui projetado para:\n- Responder perguntas sobre qualquer assunto\n- Ensinar e explicar conceitos complexos\n- Ajudar com programação e tecnologia\n- Resolver problemas matemáticos\n- Criar conteúdo e ser criativo\n- E muito mais!\n\nEstou aqui para ajudá-lo com o que precisar. Como posso ser útil?";
        }

        if (patterns.help.test(message)) {
            return "Posso ajudá-lo com muitas coisas! 💡\n\n**Programação:**\n- Explicar conceitos de programação\n- Debugar código\n- Criar exemplos práticos\n- Ensinar linguagens de programação\n\n**Conhecimento Geral:**\n- Responder perguntas sobre ciência, história, tecnologia\n- Explicar conceitos complexos de forma simples\n- Fornecer informações detalhadas\n\n**Criatividade:**\n- Ajudar com escrita e conteúdo\n- Dar ideias e sugestões\n- Resolver problemas criativamente\n\nO que você gostaria de fazer?";
        }

        if (patterns.thanks.test(message)) {
            return "Por nada! 😊 Fico feliz em ajudar! Se precisar de mais alguma coisa, é só perguntar. Estou sempre aqui para ajudar! 🤖✨";
        }

        return null;
    }

    /**
     * Gerador de respostas baseado em regras (fallback)
     */
    generateRuleBasedResponse(messages) {
        const lastMessage = messages[messages.length - 1].content;
        
        // Análise básica da mensagem
        const isQuestion = lastMessage.includes('?') || 
                          lastMessage.toLowerCase().startsWith('como') ||
                          lastMessage.toLowerCase().startsWith('o que') ||
                          lastMessage.toLowerCase().startsWith('qual') ||
                          lastMessage.toLowerCase().startsWith('quando') ||
                          lastMessage.toLowerCase().startsWith('onde') ||
                          lastMessage.toLowerCase().startsWith('por que') ||
                          lastMessage.toLowerCase().startsWith('porque');

        if (isQuestion) {
            return `Excelente pergunta! 🤔\n\nPara fornecer a melhor resposta possível, recomendo que você:\n\n1. **Use Ollama (IA Local):**\n   - Instale o Ollama: https://ollama.ai\n   - Execute: \`ollama pull llama3.2\`\n   - Inicie: \`ollama serve\`\n   - Reinicie esta aplicação\n\n2. **Configure uma API alternativa:**\n   - Anthropic Claude\n   - Google Gemini\n   - Mistral AI\n\nEnquanto isso, posso ajudá-lo de outras formas. Sobre "${lastMessage.substring(0, 50)}${lastMessage.length > 50 ? '...' : ''}", você poderia reformular a pergunta ou especificar o que gostaria de saber?`;
        }

        return `Entendo que você mencionou: "${lastMessage.substring(0, 100)}${lastMessage.length > 100 ? '...' : ''}"\n\n🤖 **Para respostas mais inteligentes e completas:**\n\nInstale o Ollama (IA gratuita e local):\n1. Acesse: https://ollama.ai\n2. Baixe e instale\n3. Execute: \`ollama pull llama3.2\`\n4. Inicie: \`ollama serve\`\n5. Reinicie esta aplicação\n\nCom o Ollama, terei acesso a modelos de IA avançados e poderei responder suas perguntas com muito mais profundidade e inteligência!\n\nComo posso ajudá-lo hoje?`;
    }

    /**
     * Verifica se Ollama está rodando
     */
    async checkOllamaHealth() {
        try {
            await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 5000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Lista modelos disponíveis no Ollama
     */
    async listModels() {
        try {
            const response = await axios.get(`${this.ollamaUrl}/api/tags`);
            return response.data.models || [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Método principal para gerar respostas
     */
    async generateResponse(messages, imageBase64 = null) {
        try {
            return await this.generateHybrid(messages, imageBase64);
        } catch (error) {
            console.error('Erro ao gerar resposta:', error);
            throw new Error('Não foi possível gerar uma resposta. Verifique a configuração da IA.');
        }
    }
}

// Integração com orquestrador híbrido
const { hybridAI } = require('./ai-hybrid');

class HybridJotaAI extends JotaAI {
    async generateResponse(messages, imageBase64 = null) {
        // Se for imagem, usa lógica antiga (Ollama vision)
        if (imageBase64) {
            return await super.generateResponse(messages, imageBase64);
        }
        // Usa orquestrador híbrido para texto
        return await hybridAI([
            { role: 'system', content: this.systemPrompt },
            ...messages
        ]);
    }
}

const jotaAI = new HybridJotaAI();
module.exports = jotaAI;
