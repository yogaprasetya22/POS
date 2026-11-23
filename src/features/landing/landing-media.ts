// Dibuat otomatis oleh scripts/landing-media-to-drive.js. Jangan diedit manual.
export const LANDING_MEDIA: Record<string, { id: string; url: string }> = {
  "/landing/video-stok.webm": {
    "id": "13GQBuXI1i3ofKqV72TBnDGxL671hNn-n",
    "url": "/api/media?id=13GQBuXI1i3ofKqV72TBnDGxL671hNn-n"
  },
  "/landing/video-dashboard.webm": {
    "id": "1q9GblQIPnvrxqXjpWezcgj_mGRGkc1JB",
    "url": "/api/media?id=1q9GblQIPnvrxqXjpWezcgj_mGRGkc1JB"
  },
  "/landing/video-dapur.webm": {
    "id": "13-WrPTkogrfrwLvomEYMCME4pJue1QE8",
    "url": "/api/media?id=13-WrPTkogrfrwLvomEYMCME4pJue1QE8"
  },
  "/landing/video-qr.webm": {
    "id": "1rUYENhy-o2NfDykhWFCWN_lOySklOJ_s",
    "url": "/api/media?id=1rUYENhy-o2NfDykhWFCWN_lOySklOJ_s"
  },
  "/landing/video-pengaturan.webm": {
    "id": "1Xgy2rP9y-UhrlEAVcMLCAsTPtZDLe9Gx",
    "url": "/api/media?id=1Xgy2rP9y-UhrlEAVcMLCAsTPtZDLe9Gx"
  },
  "/landing/video-kasir.webm": {
    "id": "1TFe6gyH8qeq1WZCSuOPogMnwh-NOaRDA",
    "url": "/api/media?id=1TFe6gyH8qeq1WZCSuOPogMnwh-NOaRDA"
  },
  "/landing/audio/stok.mp3": {
    "id": "1gH6gCpyREP2qSxwcQn6rRbMjZ8SSyKZN",
    "url": "/api/media?id=1gH6gCpyREP2qSxwcQn6rRbMjZ8SSyKZN"
  },
  "/landing/audio/qr.mp3": {
    "id": "1xTSIK56DL4un60_Yrfq977_o8zyAEXd4",
    "url": "/api/media?id=1xTSIK56DL4un60_Yrfq977_o8zyAEXd4"
  },
  "/landing/audio/dapur.mp3": {
    "id": "1VKds9Scw72qUlDrmjZV0ZyvFTwNUxcaJ",
    "url": "/api/media?id=1VKds9Scw72qUlDrmjZV0ZyvFTwNUxcaJ"
  },
  "/landing/audio/dashboard.mp3": {
    "id": "1sjKYxNBIzP9MFNmus45-5YHS8NggGyNd",
    "url": "/api/media?id=1sjKYxNBIzP9MFNmus45-5YHS8NggGyNd"
  },
  "/landing/audio/kasir.mp3": {
    "id": "1SejwaK8mkYKFfLk6DqXHy4_pEV9jGnm-",
    "url": "/api/media?id=1SejwaK8mkYKFfLk6DqXHy4_pEV9jGnm-"
  },
  "/landing/audio/pengaturan.mp3": {
    "id": "1g8cuZpkVhG-S2fq1KM2emLav1D1aM8Lm",
    "url": "/api/media?id=1g8cuZpkVhG-S2fq1KM2emLav1D1aM8Lm"
  }
} as const

/** Alamat Google Drive untuk file /landing/... (fallback ke path lokal). */
export const landingMedia = (path: string) => LANDING_MEDIA[path]?.url ?? path
