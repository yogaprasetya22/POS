"""Buat file suara dari JSON di stdin: [{"text": "...", "out": "path.wav"}]. Dipanggil oleh record.mjs."""
import json, sys, wave
from piper import PiperVoice

model = sys.argv[1]
voice = PiperVoice.load(model)
for item in json.load(sys.stdin):
    with wave.open(item["out"], "wb") as f:
        voice.synthesize_wav(item["text"], f)
