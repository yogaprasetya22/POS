import { SkeletonContainer } from '@shared/components/ui/skeleton-container'

/**
 * Kerangka loading dashboard admin / super admin / staff
 * Menggunakan SkeletonContainer dengan kontainer standar (`space-y-6 p-4 md:p-6`).
 */
export function PageSkeleton() {
  return (
    <SkeletonContainer isLoading={true} className="space-y-6 p-4 md:p-6">
      {/* Header Banner Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-5 w-28 rounded-full" />
            <span className="h-4 w-32 rounded-md" />
          </div>
          <h1 className="h-8 w-64 rounded-xl" />
          <p className="h-4 w-80 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <button className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* 4 Metric KPI Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="h-3 w-24 rounded-md" />
              <div className="size-8 rounded-lg bg-muted" />
            </div>
            <div className="h-7 w-32 rounded-lg bg-muted" />
            <p className="h-3 w-40 rounded-md" />
          </div>
        ))}
      </div>

      {/* Navigation Pills / Filter Bar Skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-10 w-28 rounded-full bg-muted" />
        <div className="h-10 w-32 rounded-full bg-muted" />
        <div className="h-10 w-36 rounded-full bg-muted" />
        <div className="h-10 w-24 rounded-full bg-muted" />
      </div>

      {/* Grid Content Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="rounded-2xl border bg-card p-4 space-y-4 shadow-xs">
            <div className="aspect-4/3 w-full rounded-xl bg-muted" />
            <div className="space-y-2">
              <div className="h-5 w-3/4 rounded-md" />
              <div className="h-4 w-1/2 rounded-md" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="h-6 w-20 rounded-md" />
              <span className="h-6 w-12 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonContainer>
  )
}

/**
 * Kerangka satu layar (sidebar + header + content) saat sesi staf pertama kali dicek.
 */
export function ShellSkeleton() {
  return (
    <SkeletonContainer isLoading={true} className="flex min-h-dvh gap-0">
      {/* Sidebar Desktop Placeholder */}
      <div className="hidden w-64 border-r bg-card p-4 space-y-6 md:block shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-muted" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-28 rounded-md" />
            <div className="h-3 w-16 rounded-md" />
          </div>
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-xl bg-muted" />
          ))}
        </div>
      </div>

      {/* Inset Area Placeholder */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 border-b bg-background px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-muted" />
            <div className="h-5 w-36 rounded-md" />
          </div>
          <div className="size-8 rounded-full bg-muted" />
        </div>
        <PageSkeleton />
      </div>
    </SkeletonContainer>
  )
}

/**
 * Kerangka halaman menu pelanggan (/s/:slug)
 * Responsif untuk Mobile maupun Desktop.
 */
export function MenuSkeleton() {
  return (
    <SkeletonContainer isLoading={true} className="min-h-dvh w-full bg-background pb-36">
      {/* Header Bar */}
      <div className="sticky top-0 z-20 border-b bg-background/90 px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-muted" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 rounded-md" />
              <div className="h-3 w-20 rounded-md" />
            </div>
          </div>
          <div className="h-10 w-44 rounded-full bg-muted hidden md:block" />
          <div className="size-10 rounded-full bg-muted md:hidden" />
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 space-y-6">
        {/* Banner Hero */}
        <div className="h-36 sm:h-44 w-full rounded-3xl bg-muted" />

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-24 rounded-full bg-muted shrink-0" />
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="rounded-2xl sm:rounded-3xl border bg-card overflow-hidden">
              <div className="aspect-4/3 w-full bg-muted" />
              <div className="p-3 sm:p-4 space-y-2">
                <div className="h-4 w-3/4 rounded-md" />
                <div className="h-4 w-1/2 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonContainer>
  )
}

/**
 * Kerangka loading kasir POS (/cashier)
 * Menggunakan SkeletonContainer dengan layout 2-kolom persis UI kasir (antrean, menu grid, ringkasan panel).
 */
export function CashierSkeleton() {
  return (
    <SkeletonContainer
      isLoading={true}
      className="grid gap-6 p-4 pb-24 md:p-6 lg:grid-cols-[1fr_22rem] lg:pb-6 xl:grid-cols-[1fr_25rem]"
    >
      <div className="min-w-0 space-y-6">
        {/* Antrean Pesanan Skeleton */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-36 rounded-md bg-muted" />
              <div className="size-6 rounded-full bg-muted" />
            </div>
            <div className="h-9 w-full sm:w-64 rounded-full bg-muted" />
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-60 shrink-0 rounded-2xl border bg-card p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 rounded-md bg-muted" />
                  <div className="h-3 w-12 rounded-md bg-muted" />
                </div>
                <div className="h-3 w-28 rounded-md bg-muted" />
                <div className="h-6 w-full rounded-md bg-muted" />
              </div>
            ))}
          </div>
        </section>

        {/* Menu & Category Pills Skeleton */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="h-6 w-28 rounded-md bg-muted" />
            <div className="h-9 w-full sm:w-64 rounded-full bg-muted" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-24 rounded-full bg-muted shrink-0" />
            ))}
          </div>
          {/* Products Grid Skeleton */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="rounded-2xl border bg-card p-3 space-y-3 shadow-2xs">
                <div className="aspect-4/3 w-full rounded-xl bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-4 w-3/4 rounded-md bg-muted" />
                  <div className="h-3.5 w-1/2 rounded-md bg-muted" />
                </div>
                <div className="h-8 w-full rounded-xl bg-muted" />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Right Aside: Ringkasan Pesanan Skeleton */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-3xl border bg-card p-4 space-y-4 shadow-sm">
          <div className="border-b pb-3 space-y-1.5">
            <div className="h-5 w-36 rounded-md bg-muted" />
            <div className="h-3.5 w-44 rounded-md bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-9 rounded-xl bg-muted" />
            <div className="h-9 rounded-xl bg-muted" />
          </div>
          <div className="h-10 w-full rounded-xl bg-muted" />
          <div className="py-8 grid place-items-center space-y-2">
            <div className="size-10 rounded-xl bg-muted" />
            <div className="h-3.5 w-48 rounded-md bg-muted" />
          </div>
          <div className="rounded-2xl border bg-muted/30 p-3 space-y-2">
            <div className="h-3.5 w-24 rounded-md bg-muted" />
            <div className="grid grid-cols-3 gap-1.5">
              <div className="h-8 rounded-lg bg-muted" />
              <div className="h-8 rounded-lg bg-muted" />
              <div className="h-8 rounded-lg bg-muted" />
            </div>
          </div>
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between">
              <div className="h-4 w-16 rounded-md bg-muted" />
              <div className="h-4 w-20 rounded-md bg-muted" />
            </div>
            <div className="h-12 w-full rounded-2xl bg-muted" />
          </div>
        </div>
      </aside>
    </SkeletonContainer>
  )
}

/**
 * Kerangka loading Layar Dapur KDS (/kitchen)
 * Menggunakan SkeletonContainer dengan layout grid kartu pesanan tablet KDS.
 */
export function KitchenSkeleton() {
  return (
    <SkeletonContainer isLoading={true} className="space-y-6 p-4 md:p-6">
      {/* Header Banner Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 sm:h-9 w-60 rounded-2xl bg-muted" />
          <div className="h-4 w-72 rounded-md bg-muted" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-11 sm:h-12 w-40 rounded-xl bg-muted" />
          <div className="h-11 sm:h-12 w-32 rounded-xl bg-muted" />
        </div>
      </div>

      {/* Grid Kartu Pesanan Dapur Tablet (KDS Cards) */}
      <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-3xl border-2 bg-card shadow-xs overflow-hidden flex flex-col justify-between">
            {/* Card Header */}
            <div className="p-4 sm:p-5 pb-3 border-b space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-7 w-28 rounded-xl bg-muted" />
                <div className="h-4 w-14 rounded-md bg-muted" />
              </div>
              <div className="h-4 w-44 rounded-md bg-muted" />
            </div>

            {/* Card Content (Status badge & order items) */}
            <div className="p-4 sm:p-5 space-y-3.5 flex-1">
              <div className="h-8 w-full rounded-xl bg-muted" />
              <div className="space-y-2.5">
                {[0, 1].map((j) => (
                  <div key={j} className="rounded-2xl border bg-muted/40 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-muted shrink-0" />
                      <div className="h-5 w-48 rounded-md bg-muted" />
                    </div>
                    <div className="h-3.5 w-32 rounded-md bg-muted ml-9" />
                  </div>
                ))}
              </div>
            </div>

            {/* Card Footer (Action button jumbo tablet) */}
            <div className="p-4 sm:p-5 pt-0">
              <div className="h-13 sm:h-14 w-full rounded-2xl bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonContainer>
  )
}


