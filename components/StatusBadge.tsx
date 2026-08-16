import { getStatusMeta, StatusRole } from "@/lib/statuses";

const ROLE_CLASSES: Record<StatusRole, string> = {
  good: "bg-status-good/10 text-status-good dark:bg-status-good/20",
  warning: "bg-status-warning/15 text-[#8a5a00] dark:text-status-warning dark:bg-status-warning/20",
  critical: "bg-status-critical/10 text-status-critical dark:bg-status-critical/20",
  neutral: "bg-ink-muted/10 text-ink-secondary dark:text-ink-secondary-dark dark:bg-ink-muted/20",
};

const ROLE_DOT: Record<StatusRole, string> = {
  good: "bg-status-good",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
  neutral: "bg-ink-muted",
};

export default function StatusBadge({ status, compact }: { status: string; compact?: boolean }) {
  const meta = getStatusMeta(status);
  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${ROLE_CLASSES[meta.role]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ROLE_DOT[meta.role]}`} />
      {meta.label}
    </span>
  );
}
