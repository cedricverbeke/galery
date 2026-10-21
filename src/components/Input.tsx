import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium uppercase tracking-wider text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={`w-full rounded-xl border bg-ink-900 px-4 py-3 text-sm text-cream placeholder:text-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-sand-300/30 ${
              icon ? 'pl-11' : ''
            } ${error ? 'border-red-800/60' : 'border-ink-600 hover:border-ink-500 focus:border-sand-300/40'} ${className}`}
            {...props}
          />
        </div>
        {error ? (
          <span className="text-xs text-red-400">{error}</span>
        ) : hint ? (
          <span className="text-xs text-muted">{hint}</span>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
