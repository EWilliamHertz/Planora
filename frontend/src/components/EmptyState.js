import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      data-testid="empty-state"
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6 text-center animate-in fade-in-0 zoom-in-95 duration-500",
        className
      )}
    >
      {Icon && (
        <div className="relative mb-5">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl scale-150 animate-pulse" />
          <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
            <Icon className="h-7 w-7 text-primary/70" strokeWidth={1.5} />
          </div>
        </div>
      )}
      <h3 className="text-base font-semibold tracking-tight mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
