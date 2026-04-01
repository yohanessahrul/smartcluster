type DashboardHeaderProps = {
  title: string;
  description: string;
};

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl tracking-tight md:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </header>
  );
}
