import { Camera, Plus, Star } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { playableUrl } from '@shared/lib/media-url'
import { MenuImage } from '@shared/components/menu-image'
import type { BuyerTemplate } from '@shared/lib/buyer-look'
import { cn, rupiah } from '@shared/lib/utils'
import { isSellable, type Product } from '@shared/types/contracts'

type Props = {
  p: Product
  t: BuyerTemplate
  qty: number
  promo: string
  /** kartu besar selebar layar (template Majalah, menu pertama) */
  hero?: boolean
  /** kartu di layar pertama: gambarnya dimuat segera */
  priority?: boolean
  /** urutan tampil (template Swiss menampilkan nomor) */
  index?: number
  onOpen: () => void
  onAdd: () => void
}

/**
 * Satu kartu menu di halaman pembeli, dalam 20 gaya. Seluruh kartu bisa diketuk (buka detail);
 * tombol + menambah langsung (menu dengan varian tetap membuka detail). Nama & harga min. 16px, tombol + 44px.
 */
export function MenuCard({ p, t, qty, promo, hero, priority, index, onOpen, onAdd }: Props) {
  const ok = isSellable(p)
  const open = (
    <button type="button" onClick={onOpen} disabled={!ok} aria-label={`Lihat ${p.name}`} className="absolute inset-0 z-[1] rounded-[inherit] focus-visible:outline-2 focus-visible:outline-ring" />
  )
  const plus = (cls = '') =>
    ok && (
      <button
        type="button"
        onClick={onAdd}
        aria-label={p.modifiers.length ? `Pilih varian ${p.name}` : `Tambah ${p.name}`}
        className={cn('relative z-[2] grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-90', cls)}
      >
        <Plus className="size-5" aria-hidden />
      </button>
    )
  const count = qty > 0 && (
    <span className="absolute right-2 top-2 z-[3] grid min-w-8 place-items-center rounded-full bg-primary px-2 py-1 text-sm font-extrabold text-primary-foreground shadow tabular-nums">{qty}</span>
  )
  const star = (cls = 'left-2 top-2') =>
    p.is_featured && ok && (
      <span className={cn('absolute z-[2] inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-sm font-extrabold text-amber-950 shadow', cls)}>
        <Star className="size-3.5 fill-current" aria-hidden /> Andalan
      </span>
    )
  const soldOut = !ok && <span className="absolute inset-0 z-[2] grid place-items-center bg-black/55 text-base font-bold text-white">Habis</span>
  const promoTag = promo && <span className="inline-block rounded-full bg-primary/12 px-2 py-0.5 text-sm font-bold text-primary">{promo}</span>
  const desc = (cls = '') => p.description && <p className={cn('line-clamp-2 text-sm leading-5 text-muted-foreground', cls)}>{p.description}</p>
  const photoCount = new Set([p.image_url, ...(p.images || [])].filter(Boolean)).size
  // penanda: menu ini punya video / beberapa foto (lihat di detail)
  const mediaBadge = photoCount > 1 && (
    <span className="pointer-events-none absolute bottom-2 right-2 z-[2] flex gap-1">
      {photoCount > 1 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-xs font-bold text-white backdrop-blur">
          <Camera className="size-3" aria-hidden /> {photoCount}
        </span>
      )}
    </span>
  )
  const photo = (aspect: string, cls = '', extra?: ReactNode, badge = true) => (
    <div className={cn('relative overflow-hidden', cls)}>
      <MenuImage src={p.image_url} alt="" aspectRatio={aspect} width={hero ? 640 : 280} priority={priority} />
      {soldOut}
      {badge && mediaBadge}
      {extra}
    </div>
  )
  const price = <span className="tabular-nums">{rupiah(p.price)}</span>
  const dim = !ok ? 'opacity-70' : ''

  switch (t) {
    case 'ringkas':
      return (
        <article className={cn('relative flex items-center gap-3 border-b bg-card px-3 py-3 last:border-b-0 md:mb-3 md:rounded-2xl md:border', dim)}>
          {open}
          {photo('aspect-square', 'w-20 shrink-0 rounded-xl')}
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="flex flex-wrap items-center gap-x-2 text-base font-semibold leading-5">
              {p.name} {p.is_featured && ok && <Star className="size-4 fill-amber-400 text-amber-400" aria-label="Andalan" />}
            </p>
            {desc()}
            <p className="flex flex-wrap items-center gap-2 text-base font-bold">{price}{promoTag}</p>
          </div>
          {qty > 0 ? <span className="z-[2] grid size-11 place-items-center rounded-full border-2 border-primary text-base font-extrabold text-primary">{qty}</span> : plus()}
        </article>
      )

    case 'galeri':
      return (
        <article className={cn('relative overflow-hidden rounded-3xl bg-muted shadow-sm', dim)}>
          {open}
          {photo('aspect-[3/4]', '', <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />)}
          {star()}
          {count}
          <div className="absolute inset-x-0 bottom-0 z-[2] flex items-end gap-2 p-3 text-white">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-base font-bold leading-5 drop-shadow">{p.name}</p>
              {p.description && <p className="line-clamp-2 text-sm leading-5 text-white/85 drop-shadow">{p.description}</p>}
              <p className="text-base font-extrabold drop-shadow">{price}</p>
            </div>
            {plus('size-11')}
          </div>
        </article>
      )

    case 'majalah':
      if (hero)
        return (
          <article className={cn('relative col-span-full grid overflow-hidden rounded-3xl bg-card shadow-sm sm:grid-cols-2', dim)}>
            {open}
            {photo('aspect-video sm:aspect-auto sm:h-full')}
            {count}
            <div className="relative space-y-2 p-5 sm:p-8">
              <p className="text-sm font-bold uppercase tracking-widest text-primary">{p.is_featured ? 'Menu andalan' : 'Pilihan hari ini'}</p>
              <p className="font-serif text-3xl font-bold leading-tight">{p.name}</p>
              {desc('line-clamp-3 text-base leading-6')}
              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-2xl font-extrabold">{price}</span>
                {plus('size-12')}
              </div>
              {promoTag}
            </div>
          </article>
        )
      return (
        <article className={cn('relative overflow-hidden rounded-2xl bg-card', dim)}>
          {open}
          {photo('aspect-square')}
          {star()}
          {count}
          <div className="space-y-1 p-3">
            <p className="line-clamp-2 font-serif text-lg font-bold leading-6">{p.name}</p>
            {desc()}
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-bold">{price}</span>
              {plus('size-10')}
            </div>
            {promoTag}
          </div>
        </article>
      )

    case 'kertas':
      return (
        <article className={cn('relative flex gap-3 border-b border-dashed py-4 font-serif', dim)}>
          {open}
          {photo('aspect-square', 'w-16 shrink-0 rounded-full border-2 border-[#6b5a3c]/30 self-start', undefined, false)}
          <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold leading-6">
              {p.name}
              {p.is_featured && ok && <span className="ml-2 align-middle font-sans text-sm font-bold text-amber-700">★ Andalan</span>}
            </p>
            <span aria-hidden className="mb-1 min-w-6 flex-1 border-b-2 border-dotted border-foreground/30" />
            <span className="text-lg font-bold">{ok ? price : <span className="font-sans text-base text-destructive">Habis</span>}</span>
          </div>
          {desc('mt-1 italic text-base')}
          <div className="mt-2 flex items-center justify-between gap-3 font-sans">
            <span>{promoTag}</span>
            {qty > 0 && <span className="text-base font-bold text-primary">{qty} di pesanan</span>}
            {ok && (
              <button type="button" onClick={onAdd} className="relative z-[2] inline-flex h-11 items-center gap-1 rounded-full border-2 border-foreground/70 px-4 text-base font-semibold hover:bg-foreground hover:text-background">
                <Plus className="size-4" aria-hidden /> {p.modifiers.length ? 'Pilih' : 'Tambah'}
              </button>
            )}
          </div>
          {photoCount > 1 && <p className="mt-1 font-sans text-sm text-muted-foreground">{photoCount} foto</p>}
          </div>
        </article>
      )

    case 'malam':
      return (
        <article className={cn('relative rounded-3xl border border-white/10 bg-card p-4 text-center', dim)}>
          {open}
          {count}
          <div className="relative mx-auto w-28">
            {photo('aspect-square', 'rounded-full ring-4 ring-primary/40 shadow-[0_0_30px_-6px_var(--primary)]')}
          </div>
          {p.is_featured && ok && <p className="mt-2 text-sm font-bold text-amber-300">★ Andalan</p>}
          <p className="mt-2 line-clamp-2 text-base font-semibold leading-5">{p.name}</p>
          {desc('mt-1')}
          <p className="mt-1 text-lg font-extrabold text-primary drop-shadow-[0_0_10px_var(--primary)]">{price}</p>
          {promoTag}
          <div className="mt-3 flex justify-center">{plus()}</div>
        </article>
      )

    case 'bento':
      return (
        <article className={cn('relative overflow-hidden rounded-2xl bg-card shadow-sm', dim)}>
          {open}
          {photo('aspect-square', '', ok && <span className="absolute bottom-1.5 left-1.5 z-[2] rounded-lg bg-black/70 px-2 py-0.5 text-sm font-bold text-white tabular-nums">{rupiah(p.price)}</span>)}
          {p.is_featured && ok && <Star className="absolute left-1.5 top-1.5 z-[2] size-6 rounded-full bg-amber-400 p-1 text-amber-950" aria-label="Andalan" />}
          {count}
          <div className="space-y-0.5 px-2 py-2">
            <p className="line-clamp-2 text-base font-semibold leading-5">{p.name}</p>
            {desc('text-[0.8125rem] leading-4')}
          </div>
        </article>
      )

    case 'pastel':
      return (
        <article className={cn('relative rounded-[2rem] bg-card p-4 text-center shadow-[0_8px_24px_-12px_var(--primary)]', dim)}>
          {open}
          {count}
          <div className="absolute inset-x-0 top-0 h-20 rounded-t-[2rem] bg-primary/15" aria-hidden />
          <div className="relative mx-auto w-28">{photo('aspect-square', 'rounded-full border-4 border-card shadow-lg')}</div>
          {p.is_featured && ok && <p className="mt-2 text-sm font-bold text-amber-600">★ Andalan</p>}
          <p className="mt-2 line-clamp-2 text-base font-bold leading-5">{p.name}</p>
          {desc('mt-1')}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="rounded-full bg-primary/12 px-3 py-1.5 text-base font-extrabold text-primary">{price}</span>
            {plus()}
          </div>
        </article>
      )

    case 'label':
      return (
        <article className={cn('relative overflow-hidden rounded-2xl bg-card shadow-md', dim)}>
          {open}
          {photo('aspect-square', '', ok && <span className="absolute left-0 top-3 z-[2] rounded-r-full bg-primary py-1.5 pl-3 pr-4 text-base font-extrabold text-primary-foreground shadow-lg tabular-nums">{rupiah(p.price)}</span>)}
          {star('right-2 top-2')}
          {qty > 0 && <span className="absolute bottom-2 right-2 z-[3] grid min-w-8 place-items-center rounded-full bg-primary px-2 py-1 text-sm font-extrabold text-primary-foreground shadow tabular-nums">{qty}</span>}
          <div className="flex items-center gap-2 p-3">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-base font-extrabold uppercase leading-5 tracking-tight">{p.name}</p>
              {desc('mt-0.5')}
              {promoTag}
            </div>
            {plus()}
          </div>
        </article>
      )

    case 'minimalis':
      return (
        <article className={cn('relative text-center', dim)}>
          {open}
          {photo('aspect-square', 'rounded-3xl')}
          {star()}
          {count}
          <p className="mt-3 line-clamp-2 text-base font-medium leading-5">{p.name}</p>
          {desc('mt-1')}
          <p className="mt-1 text-base text-muted-foreground">{price}</p>
          {promoTag}
          {ok && (
            <button type="button" onClick={onAdd} aria-label={`Tambah ${p.name}`} className="relative z-[2] mx-auto mt-2 inline-flex h-11 items-center gap-1 rounded-full px-4 text-base font-semibold text-primary hover:bg-primary/10">
              <Plus className="size-4" aria-hidden /> {p.modifiers.length ? 'Pilih' : 'Tambah'}
            </button>
          )}
        </article>
      )

    case 'kaca':
      return (
        <article className={cn('relative overflow-hidden rounded-3xl border border-white/60 bg-white/45 p-2 shadow-[0_8px_32px_-8px_rgb(0_0_0/0.18)] backdrop-blur-xl', dim)}>
          {open}
          {photo('aspect-square', 'rounded-2xl')}
          {star('left-4 top-4')}
          {count}
          <div className="space-y-1 px-1.5 pb-1 pt-2">
            <p className="line-clamp-2 text-base font-semibold leading-5">{p.name}</p>
            {desc()}
            {promoTag}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="rounded-full bg-white/70 px-3 py-1 text-base font-extrabold">{price}</span>
              {plus('size-11 ring-4 ring-white/50')}
            </div>
          </div>
        </article>
      )

    case 'neo':
      return (
        <article className={cn('relative rounded-2xl border-[3px] border-black bg-card p-2 shadow-[5px_5px_0_0_#000] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_0_#000] dark:border-white', dim)}>
          {open}
          {photo('aspect-[4/3]', 'rounded-xl border-[3px] border-black')}
          {p.is_featured && ok && <span className="absolute -left-2 -top-2 z-[2] rotate-[-6deg] rounded-md border-2 border-black bg-amber-300 px-2 py-0.5 text-sm font-black text-black">ANDALAN</span>}
          {count}
          <div className="space-y-1 px-1 pt-2">
            <p className="line-clamp-2 text-base font-black uppercase leading-5">{p.name}</p>
            {desc()}
            {promoTag}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="rounded-md border-2 border-black bg-primary px-2 py-0.5 text-base font-black text-primary-foreground">{price}</span>
              {ok && (
                <button type="button" onClick={onAdd} aria-label={`Tambah ${p.name}`} className="relative z-[2] grid size-11 place-items-center rounded-lg border-[3px] border-black bg-amber-300 text-black shadow-[3px_3px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                  <Plus className="size-5" aria-hidden />
                </button>
              )}
            </div>
          </div>
        </article>
      )

    case 'reel':
      return (
        <article className={cn('relative overflow-hidden rounded-2xl bg-black', dim)}>
          {open}
          <ReelMedia p={p} priority={priority} />
          {soldOut}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/30" />
          {star()}
          {count}
          <div className="absolute inset-x-0 bottom-0 z-[2] flex items-end gap-2 p-3 text-white">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-base font-bold leading-5">{p.name}</p>
              <p className="text-base font-extrabold">{price}</p>
              {promo && <span className="mt-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{promo}</span>}
            </div>
            {plus('size-11')}
          </div>
        </article>
      )

    case 'polaroid':
      return (
        <article className={cn('relative rotate-[-1.5deg] bg-white p-2.5 pb-4 shadow-[0_10px_25px_-10px_rgb(0_0_0/0.35)] transition-transform even:rotate-[1.5deg] hover:rotate-0', dim)}>
          {open}
          {photo('aspect-square')}
          {star()}
          {count}
          <p className="mt-3 line-clamp-2 text-center font-[cursive] text-lg font-bold leading-6 text-neutral-800">{p.name}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-base font-extrabold text-neutral-800">{price}</span>
            {plus('size-10')}
          </div>
          {promoTag}
        </article>
      )

    case 'aurora':
      return (
        <article className={cn('relative rounded-[2rem] bg-white/90 p-2.5 shadow-[0_20px_40px_-20px_var(--primary)] backdrop-blur', dim)}>
          {open}
          {photo('aspect-square', 'rounded-[1.6rem]')}
          {star('left-5 top-5')}
          {count}
          <div className="space-y-1 px-2 pb-1 pt-3">
            <p className="line-clamp-2 text-base font-bold leading-5">{p.name}</p>
            {desc()}
            {promoTag}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="bg-gradient-to-r from-primary to-fuchsia-500 bg-clip-text text-lg font-black text-transparent">{price}</span>
              {plus('size-11 bg-gradient-to-br from-primary to-fuchsia-500')}
            </div>
          </div>
        </article>
      )

    case 'mewah':
      return (
        <article className={cn('relative flex gap-4 border-b border-primary/25 bg-transparent py-4', dim)}>
          {open}
          {photo('aspect-square', 'w-28 shrink-0 rounded-sm ring-1 ring-primary/40')}
          {count}
          <div className="flex min-w-0 flex-1 flex-col">
            {p.is_featured && ok && <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Signature</p>}
            <p className="line-clamp-2 font-serif text-xl font-semibold leading-6 tracking-wide">{p.name}</p>
            {desc('mt-1 italic')}
            <div className="mt-auto flex items-center justify-between gap-2 pt-2">
              <span className="font-serif text-lg text-primary">{price}</span>
              {ok && (
                <button type="button" onClick={onAdd} aria-label={`Tambah ${p.name}`} className="relative z-[2] inline-flex h-11 items-center gap-1 rounded-none border border-primary px-4 text-sm font-semibold uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground">
                  <Plus className="size-4" aria-hidden /> {p.modifiers.length ? 'Pilih' : 'Pesan'}
                </button>
              )}
            </div>
            {promoTag}
          </div>
        </article>
      )

    case 'sinema':
      return (
        <article className={cn('relative overflow-hidden rounded-3xl bg-card shadow-lg', dim)}>
          {open}
          {photo('aspect-video', '', <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />)}
          {star()}
          {count}
          <div className="absolute inset-x-0 top-0 z-[2] aspect-video">
            <div className="absolute bottom-3 left-4 right-28 text-white">
              <p className="line-clamp-2 text-2xl font-black leading-7 drop-shadow">{p.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              {desc('text-base leading-6')}
              <div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-xl font-extrabold">{price}</span>{promoTag}</div>
            </div>
            {plus('size-12')}
          </div>
        </article>
      )

    case 'retro':
      return (
        <article className={cn('relative rounded-[1.75rem] border-2 border-[#3b2a1a] bg-[#fff6e6] p-2 text-[#3b2a1a]', dim)}>
          {open}
          {photo('aspect-square', 'rounded-[1.35rem] border-2 border-[#3b2a1a]')}
          {p.is_featured && ok && <span className="absolute right-3 top-3 z-[2] grid size-14 rotate-12 place-items-center rounded-full bg-[#ff6b35] text-center text-[0.65rem] font-black uppercase leading-3 text-white">Paling<br />laris</span>}
          {count}
          <div className="space-y-1 px-1.5 pt-2">
            <p className="line-clamp-2 text-lg font-black leading-5 tracking-tight">{p.name}</p>
            {promoTag}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-lg font-black">{price}</span>
              {plus('size-11 border-2 border-[#3b2a1a] bg-[#ff6b35] text-white')}
            </div>
          </div>
        </article>
      )

    case 'split':
      return (
        <article className={cn('relative grid grid-cols-[42%_1fr] overflow-hidden rounded-3xl bg-card shadow-sm', dim)}>
          {open}
          {photo('aspect-auto h-full min-h-40')}
          {star()}
          {count}
          <div className="flex min-w-0 flex-col gap-1 p-4">
            <p className="line-clamp-2 text-lg font-bold leading-6">{p.name}</p>
            {desc('line-clamp-3')}
            {promoTag}
            <div className="mt-auto flex items-center justify-between gap-2 pt-2">
              <span className="text-lg font-extrabold">{price}</span>
              {plus()}
            </div>
          </div>
        </article>
      )

    case 'swiss':
      return (
        <article className={cn('relative flex flex-col bg-card p-3', dim)}>
          {open}
          <p className="mb-2 font-mono text-xs text-muted-foreground">{String((index ?? 0) + 1).padStart(2, '0')}</p>
          {photo('aspect-square')}
          {count}
          <p className="mt-3 line-clamp-2 text-lg font-black uppercase leading-5 tracking-tight">{p.name}</p>
          {desc('mt-1')}
          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <span className="text-base font-bold tabular-nums">{price}</span>
            {ok && (
              <button type="button" onClick={onAdd} aria-label={`Tambah ${p.name}`} className="relative z-[2] grid size-11 place-items-center bg-foreground text-background">
                <Plus className="size-5" aria-hidden />
              </button>
            )}
          </div>
          {promoTag}
        </article>
      )

    default: // segar
      return (
        <article className={cn('relative rounded-3xl bg-card p-2 shadow-[0_6px_20px_-12px_rgb(0_0_0/0.35)]', dim)}>
          {open}
          {photo('aspect-[4/3]', 'rounded-2xl')}
          {star('left-4 top-4')}
          {count}
          <div className="space-y-1 px-1.5 pb-1 pt-2">
            <p className="line-clamp-2 text-base font-semibold leading-5">{p.name}</p>
            {desc()}
            {promoTag}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-base font-extrabold">{price}</span>
              {plus('size-11')}
            </div>
          </div>
        </article>
      )
  }
}

/** Media kartu Reel: video diputar otomatis (tanpa suara) hanya saat terlihat; tanpa video pakai foto. */
function ReelMedia({ p, priority }: { p: Product; priority?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const src = playableUrl(p.video_url)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.5 })
    io.observe(v)
    return () => io.disconnect()
  }, [src])
  if (!src) return <MenuImage src={p.image_url} alt="" aspectRatio="aspect-[9/14]" width={320} priority={priority} />
  return (
    <video
      ref={ref}
      src={src}
      poster={p.image_url || undefined}
      muted
      loop
      playsInline
      preload="none"
      className="block aspect-[9/14] w-full object-cover"
    />
  )
}
