// ai-hybrid.js
// Orquestrador de múltiplas IAs: GPT, Gemini, Ollama, Claude, etc.
// Seleciona a melhor resposta, priorizando inteligência, velocidade e contexto

const axios = require('axios');

// Configuração de APIs externas (adicione suas chaves/token)
const config = {
  openai: {
    enabled: true,
    apiKey: process.env.OPENAI_API_KEY,
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
  },
  gemini: {
    enabled: true,
    apiKey: process.env.GEMINI_API_KEY,
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    model: 'gemini-pro',
  },
  ollama: {
    enabled: true,
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.AI_MODEL || 'llama3.2',
  },
  // Adicione outros modelos aqui
};

async function askOllama(messages) {
  try {
    const response = await axios.post(`${config.ollama.url}/api/chat`, {
      model: config.ollama.model,
      messages,
      stream: false,
    }, { timeout: 60000 });
    return response.data.message.content;
  } catch (err) {
    return null;
  }
}

async function askOpenAI(messages) {
  if (!config.openai.apiKey) return null;
  try {
    const response = await axios.post(config.openai.url, {
      model: config.openai.model,
      messages,
      temperature: 0.8,
    }, {
      headers: { 'Authorization': `Bearer ${config.openai.apiKey}` },
      timeout: 60000,
    });
    return response.data.choices[0].message.content;
  } catch (err) {
    return null;
  }
}

async function askGemini(messages) {
  if (!config.gemini.apiKey) return null;
  try {
    const response = await axios.post(
      `${config.gemini.url}?key=${config.gemini.apiKey}`,
      { contents: [{ role: 'user', parts: [{ text: messages[messages.length-1].content }] }] },
      { timeout: 60000 }
    );
    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    return null;
  }
}

// Função principal: pergunta para todas as IAs e escolhe a melhor resposta
async function hybridAI(messages) {
  const results = await Promise.all([
    config.ollama.enabled ? askOllama(messages) : null,
    config.openai.enabled ? askOpenAI(messages) : null,
    config.gemini.enabled ? askGemini(messages) : null,
  ]);

  // Seleção inteligente: prioriza resposta não nula, mais longa e relevante
  const valid = results.filter(r => r && typeof r === 'string');
  if (valid.length === 0) return 'Nenhuma IA respondeu.';
  // Exemplo simples: pega a resposta mais longa
  return valid.reduce((a, b) => (b.length > a.length ? b : a));
}

module.exports = { hybridAI };