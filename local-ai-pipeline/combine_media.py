# combine_media.py
# Junta vídeo e áudio em um único arquivo sincronizado usando ffmpeg
import sys
import argparse
import subprocess

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', type=str, required=True, help='Arquivo de vídeo')
    parser.add_argument('--audio', type=str, required=True, help='Arquivo de áudio')
    parser.add_argument('--out', type=str, default='final_video.mp4', help='Arquivo de saída')
    args = parser.parse_args()
    cmd = [
        'ffmpeg', '-y', '-i', args.video, '-i', args.audio,
        '-c:v', 'copy', '-c:a', 'aac', '-shortest', args.out
    ]
    print(f"Executando: {' '.join(cmd)}")
    subprocess.run(cmd)

if __name__ == '__main__':
    main()
