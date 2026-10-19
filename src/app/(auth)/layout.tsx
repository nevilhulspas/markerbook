export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Markerbook
        </h1>
        <p className="text-sm text-muted-foreground">
          Track and understand your health data
        </p>
      </div>
      {children}
    </div>
  )
}
