import { STATUS_LABELS } from '@/lib/format';

interface BadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: BadgeProps) {
  const colors: Record<string, string> = {
    selection_pending: 'text-sand-300 bg-sand-300/10 border-sand-300/20',
    processing: 'text-blue-300 bg-blue-300/10 border-blue-300/20',
    delivered: 'text-emerald-300 bg-emerald-300/10 border-emerald-300/20',
    expired: 'text-muted bg-muted/10 border-muted/20',
  };
  const cls = colors[status] ?? 'text-muted bg-muted/10 border-muted/20';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls} ${className}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
