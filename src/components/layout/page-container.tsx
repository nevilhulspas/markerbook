import { cn } from '@/lib/utils'

type PageContainerWidth = 'default' | 'narrow' | 'wide'

interface PageContainerProps {
  children: React.ReactNode
  width?: PageContainerWidth
  className?: string
}

const WIDTH_CLASSES: Record<PageContainerWidth, string> = {
  default: '',
  narrow: 'mx-auto w-full lg:max-w-[50%]',
  // Centered but generous — for detail/reading pages that still carry a
  // dense table or wide chart and need more room than `narrow`.
  wide: 'mx-auto w-full max-w-6xl',
}

export function PageContainer({
  children,
  width = 'default',
  className,
}: PageContainerProps) {
  return <div className={cn(WIDTH_CLASSES[width], className)}>{children}</div>
}
