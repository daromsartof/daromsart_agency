import { PageHeader, Skeleton } from "@daromsart/ui";

export default function ClientsLoading() {
  return (
    <>
      <PageHeader
        title="Clients"
        description="Gérez vos clients et leurs contacts."
      />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-2 rounded-xl border p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key -- squelette statique, pas de réordonnancement
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </>
  );
}
