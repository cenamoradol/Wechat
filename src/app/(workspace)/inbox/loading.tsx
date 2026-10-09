export default function InboxLoading() {
  return (
    <div className="flex h-full">
      <aside className="hidden w-80 shrink-0 border-r md:flex md:flex-col">
        <div className="border-b p-3">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex-1 space-y-1 p-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md p-2">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-2 w-full animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">Cargando…</div>
      </main>
    </div>
  );
}