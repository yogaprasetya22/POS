#!/usr/bin/env python3
"""
Generator Suara Narasi (TTS) untuk Demo POS Landing Page & Tutorial.
Mendukung:
  1. Fish Audio API (jika ada FISH_AUDIO_API_KEY)
  2. Fish Audio Browser Automator (via playwright persistent context .fish-profile)
  3. Edge TTS (Indonesian Neural Voice id-ID-GadisNeural / id-ID-ArdiNeural - gratis & instan)

Penggunaan:
  python3 scripts/generate-audio.py --mode edge
  python3 scripts/generate-audio.py --mode fish-api --api-key fa_xxxx
  python3 scripts/generate-audio.py --mode fish-browser
"""

import os
import sys
import json
import argparse
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "landing" / "audio"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 6 Naskah Narasi Fitur Demo Landing Page (Disesuaikan dengan ritme & durasi video demo)
LANDING_SCRIPTS = {
    "kasir": {
        "title": "Kasir POS & Transaksi",
        "video": ROOT / "public" / "landing" / "video-kasir.webm",
        "text": (
            "Sistem kasir POS siap pakai. Buka shift kasir dengan modal awal di laci, "
            "pilih menu makanan dan minuman secara instan, masukkan nama pembeli, "
            "dan terima pembayaran tunai uang pas atau QRIS dengan cetak struk thermal otomatis."
        ),
    },
    "qr": {
        "title": "Menu QR Meja Tamu",
        "video": ROOT / "public" / "landing" / "video-qr.webm",
        "text": (
            "Pelanggan memesan mandiri langsung dari meja lewat kode QR tanpa perlu unduh aplikasi. "
            "Katalog menu lengkap dengan foto menggugah selera, pilih varian dan catatan rasa, "
            "masukkan nama pelanggan, dan pesanan otomatis masuk antrean dengan nomor tiket."
        ),
    },
    "dapur": {
        "title": "Layar Dapur KDS",
        "video": ROOT / "public" / "landing" / "video-dapur.webm",
        "text": (
            "Layar dapur KDS memantau setiap pesanan masuk secara real-time. "
            "Koki dapat mencentang setiap item menu yang matang dan menekan tombol siap diambil "
            "agar pesanan segera diantar pramusaji tanpa salah meja."
        ),
    },
    "dashboard": {
        "title": "Dashboard Laba & Omset",
        "video": ROOT / "public" / "landing" / "video-dashboard.webm",
        "text": (
            "Pantau performa penjualan dan uang masuk hari ini secara langsung. "
            "Lihat laba kotor, metode pembayaran favorit, grafik tren transaksi, "
            "serta unduh laporan keuangan lengkap per hari maupun per produk."
        ),
    },
    "stok": {
        "title": "Manajemen Stok & Bahan",
        "video": ROOT / "public" / "landing" / "video-stok.webm",
        "text": (
            "Kelola inventaris dan bahan baku resto dengan akurat. "
            "Sistem otomatis menghitung pemakaian bahan berdasarkan resep menu, "
            "memberikan peringatan stok menipis, dan terhubung langsung ke purchase order pemasok."
        ),
    },
    "pengaturan": {
        "title": "Pengaturan Toko & Struk",
        "video": ROOT / "public" / "landing" / "video-pengaturan.webm",
        "text": (
            "Fleksibilitas penuh mengatur identitas toko. "
            "Sesuaikan format struk thermal 58 atau 80 milimeter, atur perhitungan pajak PB1 dan service charge, "
            "buat kode QR per meja, serta kelola hak akses staf kasir dan dapur dengan aman."
        ),
    },
}

def get_openai_key():
    key = os.getenv("OPENAI_API_KEY", "")
    if not key and (ROOT / ".env").exists():
        for line in (ROOT / ".env").read_text().splitlines():
            if line.startswith("OPENAI_API_KEY="):
                key = line.split("=", 1)[1].strip().strip("\"'")
                break
    return key

def generate_via_openai(voice="echo"):
    """Generate suara laki-laki natural, luwes, dan ramah via OpenAI TTS (echo/onyx)."""
    import urllib.request
    
    key = get_openai_key()
    if not key:
        print("❌ Error: OPENAI_API_KEY tidak ditemukan di environment atau .env")
        return False
        
    print(f"🎙️ Menggunakan OpenAI TTS Natural Male Voice (Voice: {voice})...")
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    
    for key_name, item in LANDING_SCRIPTS.items():
        out_mp3 = OUT_DIR / f"{key_name}.mp3"
        print(f"-> Memproses narasi laki-laki untuk: {item['title']}...")
        payload = {
            "model": "tts-1",
            "input": item["text"],
            "voice": voice,
            "speed": 1.05
        }
        req = urllib.request.Request(
            "https://api.openai.com/v1/audio/speech",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        try:
            with urllib.request.urlopen(req) as resp:
                data = resp.read()
                out_mp3.write_bytes(data)
                print(f"   ✓ Suara jernih tersimpan: {out_mp3.name} ({len(data):,} bytes)")
        except Exception as e:
            print(f"   ✗ Gagal generate OpenAI TTS ({key_name}): {e}")
            return False
    return True

def generate_via_fish_api(key, model_id=None):
    """Generate audio menggunakan REST API resmi Fish Audio."""
    import urllib.request
    
    headers = {
        "Authorization": f"Bearer {key.strip()}",
        "Content-Type": "application/json"
    }
    
    print("🐟 Menggunakan Fish Audio REST API...")
    for key_name, item in LANDING_SCRIPTS.items():
        out_mp3 = OUT_DIR / f"{key_name}.mp3"
        print(f"-> Memproses suara untuk: {item['title']}...")
        payload = {
            "text": item["text"],
            "format": "mp3"
        }
        if model_id:
            payload["reference_id"] = model_id
            
        req = urllib.request.Request(
            "https://api.fish.audio/v1/tts",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        try:
            with urllib.request.urlopen(req) as resp:
                data = resp.read()
                out_mp3.write_bytes(data)
                print(f"   ✓ Berhasil disimpan: {out_mp3.name} ({len(data):,} bytes)")
        except Exception as e:
            print(f"   ✗ Gagal Fish Audio API ({key_name}): {e}")

def generate_via_edge_tts(voice="id-ID-ArdiNeural"):
    """Generate suara natural laki-laki Indonesia gratis menggunakan Edge TTS."""
    print(f"🔊 Menggunakan Edge Neural TTS Laki-laki (Suara: {voice})...")
    import asyncio
    import edge_tts
    
    async def process_all():
        for key_name, item in LANDING_SCRIPTS.items():
            out_mp3 = OUT_DIR / f"{key_name}.mp3"
            print(f"-> Memproses suara untuk: {item['title']}...")
            comm = edge_tts.Communicate(item["text"], voice, rate="+2%")
            await comm.save(str(out_mp3))
            print(f"   ✓ Berhasil disimpan: {out_mp3.name} ({out_mp3.stat().st_size:,} bytes)")

    asyncio.run(process_all())

def merge_audio_to_videos():
    """Menggabungkan audio MP3 ke video demo WebM landing page."""
    print("\n🎬 Menggabungkan audio narasi laki-laki ke video demo...")
    for key_name, item in LANDING_SCRIPTS.items():
        audio_file = OUT_DIR / f"{key_name}.mp3"
        video_file = item["video"]
        if not audio_file.exists() or not video_file.exists():
            continue
            
        tmp_video = video_file.parent / f"tmp-{video_file.name}"
        print(f"-> Menggabungkan {video_file.name} + {audio_file.name}")
        cmd = [
            "ffmpeg", "-y",
            "-i", str(video_file),
            "-i", str(audio_file),
            "-c:v", "copy",
            "-c:a", "libopus",
            "-b:a", "96k",
            "-shortest",
            str(tmp_video)
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if tmp_video.exists() and tmp_video.stat().st_size > 1000:
            tmp_video.replace(video_file)
            print(f"   ✓ Video demo terbarui: {video_file.name} ({round(video_file.stat().st_size/1024)} KB)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TTS Audio Generator untuk POS Landing Page")
    parser.add_argument("--mode", choices=["openai", "edge", "fish-api", "merge-only"], default="openai", help="Metode TTS")
    parser.add_argument("--voice", default="echo", help="Pilihan suara (openai: echo/onyx; edge: id-ID-ArdiNeural)")
    parser.add_argument("--api-key", default=os.getenv("FISH_AUDIO_API_KEY", ""), help="Fish Audio API Key")
    parser.add_argument("--model-id", default=None, help="Fish Audio Model/Voice ID")
    parser.add_argument("--merge", action="store_true", help="Gabungkan audio ke file video WebM")
    args = parser.parse_args()

    if args.mode == "openai":
        ok = generate_via_openai(voice=args.voice)
        if not ok:
            print("Mencoba fallback ke Edge TTS (Ardi)...")
            generate_via_edge_tts(voice="id-ID-ArdiNeural")
    elif args.mode == "fish-api":
        if not args.api_key:
            print("❌ Error: API key wajib diisi jika menggunakan mode fish-api (--api-key atau FISH_AUDIO_API_KEY)")
            sys.exit(1)
        generate_via_fish_api(args.api_key, args.model_id)
    elif args.mode == "edge":
        generate_via_edge_tts(voice=args.voice if "Neural" in args.voice else "id-ID-ArdiNeural")
    elif args.mode == "merge-only":
        merge_audio_to_videos()
        sys.exit(0)

    if args.merge:
        merge_audio_to_videos()

