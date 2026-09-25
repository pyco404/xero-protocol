#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="public/xero-protocol-intro.mp4"

ffmpeg -y \
  -f lavfi \
  -i "color=c=#070d18:s=1920x1080:d=9,format=rgba,zoompan=z='min(zoom+0.0009,1.16)':d=1:s=1920x1080:fps=30" \
  -vf "
    drawgrid=width=110:height=110:thickness=1:color=#1a2740@0.6,
    drawbox=x=100:y=100:w=760:h=500:color=#0d1526@0.82:t=fill,
    drawbox=x=100:y=610:w=760:h=260:color=#101b2c@0.72:t=fill,
    drawbox=x=900:y=120:w=920:h=740:color=#0f172b@0.78:t=fill,
    drawbox=x=980:y=200:w=260:h=80:color=#8ef0ca@0.15:t=fill,
    drawbox=x=980:y=330:w=700:h=58:color=#0a1220@0.84:t=fill,
    drawbox=x=980:y=418:w=700:h=58:color=#0a1220@0.84:t=fill,
    drawbox=x=980:y=506:w=700:h=58:color=#0a1220@0.84:t=fill,
    drawbox=x=980:y=594:w=700:h=58:color=#0a1220@0.84:t=fill,
    drawbox=x=1320:y=690:w=250:h=110:color=#8ef0ca@0.18:t=fill,
    drawbox=x=140:y=150:w=8:h=410:color=#8ef0ca@1:t=fill,
    drawbox=x=1520:y=180:w=8:h=440:color=#8ef0ca@0.8:t=fill,
    drawbox=x=250:y=270:w=490:h=180:color=#111d30@0.78:t=fill,
    drawbox=x=280:y=740:w=200:h=90:color=#8ef0ca@0.12:t=fill,
    drawbox=x=1340:y=740:w=280:h=90:color=#8ef0ca@0.12:t=fill,
    drawbox=x=1080:y=690:w=170:h=120:color=#0b1828@0.8:t=fill,
    drawbox=x=180:y=730:w=14:h=14:color=#8ef0ca@1:t=fill,
    drawbox=x=220:y=730:w=14:h=14:color=#8ef0ca@0.6:t=fill,
    drawbox=x=260:y=730:w=14:h=14:color=#8ef0ca@0.3:t=fill,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='XERO':fontcolor=#d9e3f8:fontsize=52:x=180:y=185,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='PRIVATE':fontcolor=#8ef0ca:fontsize=28:x=180:y=270,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='Money that can prove what it is allowed to do.':fontcolor=white:fontsize=48:x=150:y=400,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='sender · amount · policy · proof · settlement':fontcolor=#c8d7f0:fontsize=24:x=150:y=500,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='ALLOWLIST  ✓':fontcolor=#8ef0ca:fontsize=22:x=182:y=655,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='AMOUNT  $0.42':fontcolor=#c8d7f0:fontsize=22:x=182:y=695,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='PROOF  VERIFIED':fontcolor=#8ef0ca:fontsize=22:x=182:y=735,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='XERO POLICY':fontcolor=#9db5d8:fontsize=20:x=980:y=165,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='provider check':fontcolor=#c8d7f0:fontsize=20:x=1020:y=345,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='amount within limit':fontcolor=#c8d7f0:fontsize=20:x=1020:y=433,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='agent authorized':fontcolor=#c8d7f0:fontsize=20:x=1020:y=521,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='zk proof generated':fontcolor=#c8d7f0:fontsize=20:x=1020:y=609,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='SETTLED':fontcolor=#8ef0ca:fontsize=36:x=1370:y=720,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='SOLANA • STABLECOINS • ZK PRIVACY':fontcolor=#dfe7f5:fontsize=28:x=1380:y=860,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='XERO':fontcolor=white:fontsize=228:x=(w-text_w)/2+300:y=(h-text_h)/2-80,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='Private by design. Verifiable by default.':fontcolor=#c8d7f0:fontsize=36:x=1120:y=800,
    fade=t=in:st=0:d=0.7,fade=t=out:st=8.3:d=0.9
  " \
  -pix_fmt yuv420p \
  -c:v libx264 \
  -preset medium \
  -crf 22 \
  -movflags +faststart \
  "$OUT"

ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1:nokey=1 "$OUT"
