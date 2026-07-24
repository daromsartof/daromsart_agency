export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t bg-background py-4 text-center text-xs text-muted-foreground">
        Propulsé par Daromsart Système
      </footer>
    </div>
  );
}
