"""Buat suara gratis (Microsoft Edge neural TTS) dari docs/narasi.txt: satu mp3 per blok '---'.
Pakai:  scripts/tutorial/.tts/venv/bin/python scripts/tutorial/gen-edge.py [narasi.txt] [out_dir] [voice]
Nama file sama dengan docs/fish_ai.py (slide-01.mp3, ...), jadi bisa langsung dipakai record.mjs --audio.
Catatan: teks narasi dikirim ke layanan suara Microsoft (endpoint tidak resmi, bisa berubah)."""
import asyncio, sys
from pathlib import Path
import edge_tts

src = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/narasi.txt")
out = Path(sys.argv[2] if len(sys.argv) > 2 else "docs/audio-edge")
voice = sys.argv[3] if len(sys.argv) > 3 else "id-ID-GadisNeural"
chunks = [c.strip() for c in src.read_text(encoding="utf-8").split("\n---\n") if c.strip()]
out.mkdir(parents=True, exist_ok=True)

async def one(i, text):
    f = out / f"slide-{i:02d}.mp3"
    if f.exists() and f.stat().st_size > 1000:
        return
    for attempt in range(3):
        try:
            await edge_tts.Communicate(text, voice, rate="-3%").save(str(f))
            if f.stat().st_size > 1000:
                return
        except Exception as e:
            print(f"  slide {i} percobaan {attempt + 1} gagal: {e}")
        await asyncio.sleep(2)
    print(f"  slide {i} GAGAL")

async def main():
    sem = asyncio.Semaphore(4)
    async def run(i, t):
        async with sem:
            await one(i, t)
    await asyncio.gather(*(run(i, t) for i, t in enumerate(chunks, 1)))

asyncio.run(main())
n = sum(1 for i in range(1, len(chunks) + 1) if (out / f"slide-{i:02d}.mp3").exists())
print(f"{n}/{len(chunks)} slide tersimpan di {out}")
