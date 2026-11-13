#!/usr/bin/env python3
"""
Narasi per slide -> mp3 lewat Fish Audio (voice "ledi") di browser, tanpa API key.

Pakai:
  pip install playwright && playwright install chromium
  python tools/fish_tts.py login            # sekali saja: login manual di jendela browser
  python tools/fish_tts.py narasi.txt       # generate

Format narasi.txt: satu slide per blok, dipisah baris berisi '---'.
Hasil: tools/audio/slide-01.mp3, slide-02.mp3, ...
Login disimpan di tools/.fish-profile (jangan di-commit). Tidak perlu salin cookie.
"""
import subprocess
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

MODEL = "348a941b15c040d8b3f4ef1914f6e665"
URL = f"https://fish.audio/app/text-to-speech/?modelId={MODEL}"
HERE = Path(__file__).parent
PROFILE = HERE / ".fish-profile"
OUT = HERE / "audio"


def launch(p, headless):
    ctx = p.chromium.launch_persistent_context(
        str(PROFILE), headless=headless, accept_downloads=True
    )
    ctx.add_cookies([
        {"name": "token", "value": "b93ea881-4973-4a56-93c4-1d15eaafc01c", "domain": "fish.audio", "path": "/"}
    ])
    return ctx


def login():
    print("Membuka browser Chromium...")
    print("Silakan login (Google / Email) di jendela browser yang terbuka.")
    with sync_playwright() as p:
        ctx = launch(p, False)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(URL)
        page.wait_for_load_state("domcontentloaded")

        # Tutup pop-up jika ada
        close_btn = page.locator("button:has-text('Close')")
        if close_btn.is_visible():
            try:
                close_btn.click(timeout=1000)
            except Exception:
                pass

        input("\nSetelah berhasil login, kembali ke terminal ini dan tekan Enter... ")
        ctx.close()
        print(f"\n[✓] Profil dan sesi login tersimpan di: {PROFILE}\n")


def split_text(text, max_len=450):
    if len(text) <= max_len:
        return [text]
    sentences = text.replace(". ", ".\n").splitlines()
    parts = []
    curr = ""
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if len(curr) + len(s) + 1 <= max_len:
            curr = (curr + " " + s).strip()
        else:
            if curr:
                parts.append(curr)
            curr = s
    if curr:
        parts.append(curr)
    return parts


def synthesize_part(page, text, target_file):
    page.goto(URL)
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(3000)

    # Tutup dialog modal jika ada
    for _ in range(3):
        if page.locator("[role=dialog]").count() > 0:
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)

    # Isi teks narasi ke editor
    box = page.locator("[contenteditable='true'], textarea, [role='textbox']").first
    box.wait_for(timeout=30000)
    box.click(force=True)
    page.keyboard.press("Control+A")
    page.keyboard.press("Backspace")
    box.fill(text)
    page.wait_for_timeout(500)

    # Trigger Generate Speech via Ctrl+Enter
    page.keyboard.press("Control+Enter")
    page.wait_for_timeout(2000)

    # Cek pop-up login atau kuota habis
    login_dialog = page.locator("[role='dialog']:has-text('Sign in'), [role='dialog']:has-text('Unlock the Full Potential')")
    if login_dialog.is_visible():
        raise RuntimeError("Sesi Fish Audio belum login atau token habis.")

    credit_dialog = page.locator("[role='dialog']:has-text('credits are used up'), [role='dialog']:has-text('Upgrade to Plus')")
    if credit_dialog.is_visible():
        raise RuntimeError("Kuota akun Fish Audio habis (free credits used up).")

    # Cek pop-up survey Take 1 / Take 2 (yang bikin tombol download disabled)
    try:
        fb = page.locator("button:has-text('Both are good'), button:has-text('Take 1 is better')").first
        if fb.is_visible():
            fb.click(timeout=2000)
            page.wait_for_timeout(500)
    except Exception:
        pass

    # Tunggu tombol download dan pastikan aktif (tidak disabled)
    dl = page.locator("button:has(svg[class*=download]):not([disabled]), button[aria-label*='Download']:not([disabled]), button:has-text('Download'):not([disabled])").first
    dl.wait_for(state="visible", timeout=60000)
    with page.expect_download(timeout=30000) as d:
        dl.click()
    d.value.save_as(target_file)


def generate(src, headless=True):
    src_path = Path(src)
    if not src_path.exists():
        src_path = HERE / src
    if not src_path.exists():
        sys.exit(f"File tidak ditemukan: {src}")

    chunks = [c.strip() for c in src_path.read_text(encoding="utf-8").split("\n---\n") if c.strip()]
    OUT.mkdir(exist_ok=True)
    print(f"Total slide: {len(chunks)}. Memulai proses TTS...")
    with sync_playwright() as p:
        ctx = launch(p, headless=headless)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        for i, text in enumerate(chunks, 1):
            out_file = OUT / f"slide-{i:02d}.mp3"
            if out_file.exists() and out_file.stat().st_size > 1000:
                print(f"[{i}/{len(chunks)}] Slide {i} sudah ada ({out_file.name}), dilewati.")
                continue

            print(f"[{i}/{len(chunks)}] Memproses slide {i} ({len(text)} karakter)...")
            sub_parts = split_text(text, max_len=450)
            
            try:
                if len(sub_parts) == 1:
                    synthesize_part(page, sub_parts[0], out_file)
                    print(f"  -> Sukses: {out_file.name} ({out_file.stat().st_size:,} bytes)")
                else:
                    print(f"  -> Teks melebihi 450 karakter ({len(text)} char). Dibagi jadi {len(sub_parts)} bagian...")
                    part_files = []
                    for p_idx, part in enumerate(sub_parts, 1):
                        part_file = OUT / f"slide-{i:02d}_part{p_idx}.mp3"
                        print(f"     Bagian {p_idx}/{len(sub_parts)} ({len(part)} char)...")
                        synthesize_part(page, part, part_file)
                        part_files.append(part_file)

                    # Gabungkan menggunakan ffmpeg
                    concat_str = "concat:" + "|".join(str(f) for f in part_files)
                    subprocess.run(
                        ["ffmpeg", "-y", "-i", concat_str, "-acodec", "copy", str(out_file)],
                        check=True,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL
                    )
                    # Hapus file part sementara
                    for f in part_files:
                        f.unlink(missing_ok=True)

                    print(f"  -> Sukses digabung: {out_file.name} ({out_file.stat().st_size:,} bytes)")
            except Exception as e:
                page.screenshot(path=str(HERE / f"error-{i:02d}.png"))
                print(f"  -> Gagal slide {i} ({e}); screenshot disimpan di error-{i:02d}.png")
        ctx.close()
    print(f"\n[✓] Selesai! Seluruh file tersimpan di {OUT}/\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    if sys.argv[1] == "login":
        login()
    else:
        gui = "--gui" in sys.argv
        target = [a for a in sys.argv[1:] if not a.startswith("--")][0]
        generate(target, headless=not gui)
