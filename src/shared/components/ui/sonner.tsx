import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // flex-wrap: dengan dua tombol, tombol turun ke baris baru alih-alih menjepit teks
          toast: "cn-toast !text-base !gap-3 !p-4 !flex-wrap",
          content: "!min-w-[14rem] !flex-1",
          cancelButton: "!h-10 !px-4 !text-base",
          title: "!text-base !font-bold",
          description: "!text-base",
          actionButton: "!h-10 !px-4 !text-base !font-bold",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
