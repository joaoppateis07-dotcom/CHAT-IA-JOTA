# Pipeline Local de Geração de Vídeo, Áudio e Fala (100% Gratuito)

Este diretório contém scripts e instruções para rodar modelos open source localmente e gerar vídeos hiper-realistas, áudios e falas em português, sem custo recorrente.

## Pré-requisitos
- Python 3.10+
- ffmpeg instalado e no PATH
- (Opcional, mas recomendado) GPU NVIDIA para acelerar modelos

## Modelos Utilizados
- **Stable Video Diffusion** (vídeo a partir de imagem ou texto)
- **Bark** ou **Coqui TTS** (voz/fala em português)
- **Riffusion** (música/áudio instrumental)

## Instalação dos Modelos

1. Clone os repositórios oficiais dos modelos:
   - Stable Video Diffusion: https://github.com/stability-ai/stable-video-diffusion
   - Bark: https://github.com/suno-ai/bark
   - Coqui TTS: https://github.com/coqui-ai/TTS
   - Riffusion: https://github.com/riffusion/riffusion

2. Instale as dependências de cada modelo (veja README de cada projeto).

3. Certifique-se de que ffmpeg está instalado e acessível pelo terminal.

## Pipeline Exemplo (Python)

- `generate_video.py`: Gera vídeo a partir de texto ou imagem usando Stable Video Diffusion.
- `generate_audio.py`: Gera fala em português a partir de texto usando Bark ou Coqui TTS.
- `combine_media.py`: Junta vídeo e áudio em um único arquivo sincronizado usando ffmpeg.

## Como Usar

1. Gere o vídeo:
   ```sh
   python generate_video.py --prompt "descrição do vídeo"
   # ou
   python generate_video.py --input_image minha_imagem.png
   ```
2. Gere o áudio/fala:
   ```sh
   python generate_audio.py --text "texto da fala em português"
   ```
3. Combine vídeo e áudio:
   ```sh
   python combine_media.py --video output.mp4 --audio output.wav --out final_video.mp4
   ```

## Observações
- A qualidade depende do hardware local e dos modelos escolhidos.
- Tudo roda localmente, sem custo recorrente.
- Pode ser expandido para gifs, música, etc.

---

Se quiser, posso gerar os scripts Python iniciais para você começar!
