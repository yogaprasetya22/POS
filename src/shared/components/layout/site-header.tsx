import { useLocation } from 'react-router'
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@shared/components/ui/breadcrumb'
import { Separator } from '@shared/components/ui/separator'
import { SidebarTrigger } from '@shared/components/ui/sidebar'
import { findNav } from './nav'
import { Clock } from './parts'

/** Kepala halaman (pola SiteHeader dashboard-01): tombol sidebar, breadcrumb Grup › Halaman, jam. */
export function SiteHeader() {
  const { pathname } = useLocation()
  const here = findNav(pathname)
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b print:hidden">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {here && (
              <>
                <BreadcrumbItem className="hidden whitespace-nowrap sm:inline-flex">{here.group}</BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage className="truncate whitespace-nowrap text-base font-medium">{here?.item.label ?? 'Admin'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto">
          <Clock />
        </div>
      </div>
    </header>
  )
}
