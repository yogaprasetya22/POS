import { Suspense, lazy, type ComponentProps } from 'react'
import { ChartSkeleton } from '@shared/components/skeletons'

/** Grafik dimuat terpisah (pustaka recharts besar); selama dimuat tampil kerangka abu-abu. */
const load = () => import('./charts')
const L = {
  SalesTrendChart: lazy(() => load().then((m) => ({ default: m.SalesTrendChart }))),
  HourlyChart: lazy(() => load().then((m) => ({ default: m.HourlyChart }))),
  MethodsChart: lazy(() => load().then((m) => ({ default: m.MethodsChart }))),
  RankBars: lazy(() => load().then((m) => ({ default: m.RankBars }))),
  CashDiffChart: lazy(() => load().then((m) => ({ default: m.CashDiffChart }))),
}
type C = typeof import('./charts')

export const SalesTrendChart = (p: ComponentProps<C['SalesTrendChart']>) => <Suspense fallback={<ChartSkeleton />}><L.SalesTrendChart {...p} /></Suspense>
export const HourlyChart = (p: ComponentProps<C['HourlyChart']>) => <Suspense fallback={<ChartSkeleton />}><L.HourlyChart {...p} /></Suspense>
export const MethodsChart = (p: ComponentProps<C['MethodsChart']>) => <Suspense fallback={<ChartSkeleton />}><L.MethodsChart {...p} /></Suspense>
export const RankBars = (p: ComponentProps<C['RankBars']>) => <Suspense fallback={<ChartSkeleton />}><L.RankBars {...p} /></Suspense>
export const CashDiffChart = (p: ComponentProps<C['CashDiffChart']>) => <Suspense fallback={<ChartSkeleton />}><L.CashDiffChart {...p} /></Suspense>
