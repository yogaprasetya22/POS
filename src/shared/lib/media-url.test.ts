import { describe, expect, it } from 'vitest'
import { playableUrl } from './media-url'

describe('playableUrl', () => {
  it('mengalihkan tautan Drive ke /api/media', () => {
    expect(playableUrl('https://drive.google.com/uc?export=download&id=1AbCdEfGhIjK')).toBe('/api/media?id=1AbCdEfGhIjK')
    expect(playableUrl('https://drive.google.com/file/d/1AbCdEfGhIjK/view')).toBe('/api/media?id=1AbCdEfGhIjK')
  })
  it('membiarkan alamat lain', () => {
    expect(playableUrl('https://cdn.example.com/a.mp4')).toBe('https://cdn.example.com/a.mp4')
    expect(playableUrl(null)).toBe('')
  })
})
