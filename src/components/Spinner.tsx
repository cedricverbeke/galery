interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const dims = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-10 w-10' : 'h-6 w-6';
  return (
    <div
      className={`${dims} animate-spin rounded-full border-2 border-ink-600 border-t-sand-300 ${className}`}
    />
  );
}

export function FullSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Spinner size="lg" />
      {label && <p className="text-sm text-muted">{label}</p>}
    </div>
  );
}
