#!/usr/bin/env bash
# Synthesizes a quiet ambient drone (open fifths on A, slow swell) into public/music.mp3.
# Generated locally from sine tones, so there is no licensing to track.
set -euo pipefail
cd "$(dirname "$0")/.."
DUR="${1:-75}"

ffmpeg -y -loglevel error \
  -f lavfi -i "sine=frequency=110:duration=${DUR}" \
  -f lavfi -i "sine=frequency=164.81:duration=${DUR}" \
  -f lavfi -i "sine=frequency=220.5:duration=${DUR}" \
  -f lavfi -i "sine=frequency=329.2:duration=${DUR}" \
  -f lavfi -i "anoisesrc=color=pink:amplitude=0.02:duration=${DUR}" \
  -filter_complex "
    [0]volume='0.50*(0.8+0.2*sin(2*PI*0.07*t))':eval=frame[a];
    [1]volume='0.30*(0.7+0.3*sin(2*PI*0.05*t+1))':eval=frame[b];
    [2]volume='0.22*(0.6+0.4*sin(2*PI*0.11*t+2))':eval=frame[c];
    [3]volume='0.10*(0.5+0.5*sin(2*PI*0.09*t+3))':eval=frame[d];
    [4]lowpass=f=600,volume=0.6[n];
    [a][b][c][d][n]amix=inputs=5:normalize=0,
    lowpass=f=1400,aecho=0.8:0.7:420|780:0.35|0.25,
    afade=t=in:d=3,afade=t=out:st=$((DUR - 4)):d=4,
    aformat=channel_layouts=stereo,loudnorm=I=-28:TP=-6
  " \
  -ar 44100 -c:a libmp3lame -b:a 160k public/music.mp3

cat > src/music.json <<JSON
{ "file": "music.mp3", "volume": 0.6 }
JSON
echo "public/music.mp3 (${DUR}s)"
