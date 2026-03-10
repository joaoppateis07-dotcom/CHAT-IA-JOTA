// ai-media.js
// Geração de imagens, vídeos, gifs e áudios via múltiplas APIs
const axios = require('axios');

const config = {
  dalle: {
    enabled: true,
    apiKey: process.env.OPENAI_API_KEY,
    url: 'https://api.openai.com/v1/images/generations',
  },
  stableDiffusion: {
    enabled: true,
    apiKey: process.env.SD_API_KEY, // Exemplo: https://stablediffusionapi.com/
    url: 'https://stablediffusionapi.com/api/v3/text2img',
  },
  elevenlabs: {
    enabled: true,
    apiKey: process.env.ELEVENLABS_API_KEY,
    url: 'https://api.elevenlabs.io/v1/text-to-speech',
    voice: process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
  },
  // Adicione outros serviços aqui
};

async function generateImage(prompt) {
  // Prioridade: DALL-E > Stable Diffusion
  if (config.dalle.enabled && config.dalle.apiKey) {
    try {
      const response = await axios.post(
        config.dalle.url,
        { prompt, n: 1, size: '1024x1024' },
        { headers: { 'Authorization': `Bearer ${config.dalle.apiKey}` } }
      );
      return response.data.data[0].url;
    } catch (err) {}
  }
  if (config.stableDiffusion.enabled && config.stableDiffusion.apiKey) {
    try {
      const response = await axios.post(
        config.stableDiffusion.url,
        { key: config.stableDiffusion.apiKey, prompt, width: 1024, height: 1024, samples: 1 },
      );
      return response.data.output[0];
    } catch (err) {}
  }
  return null;
}

async function generateAudio(text) {
  // Prioridade: ElevenLabs
  if (config.elevenlabs.enabled && config.elevenlabs.apiKey) {
    try {
      const response = await axios.post(
        `${config.elevenlabs.url}/${config.elevenlabs.voice}/stream`,
        { text },
        { headers: { 'xi-api-key': config.elevenlabs.apiKey }, responseType: 'arraybuffer' }
      );
      return response.data; // Buffer de áudio
    } catch (err) {}
  }
  return null;
}

// Função de decisão automática
async function generateMedia({ type, prompt, text }) {
  if (type === 'image') return await generateImage(prompt);
  if (type === 'audio') return await generateAudio(text);
  // TODO: adicionar vídeo, gif, etc.
  return null;
}

module.exports = { generateMedia };
