import { Camera } from 'lucide-react';
import { navigate } from '@/lib/router';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export function Logo({ size = 'md', onClick }: LogoProps) {
  const dims = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-12 w-12' : 'h-9 w-9';
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 26 : 20;
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  const handleClick = onClick ?? (() => navigate('/'));

  return (
    <button onClick={handleClick} className="group flex items-center gap-2.5">
      <div
        className={`${dims} flex items-center justify-center rounded-full border border-sand-300/40 bg-ink-900 text-sand-300 transition-all duration-300 group-hover:border-sand-300/80 group-hover:bg-sand-300/10`}
      >
        <Camera size={iconSize} strokeWidth={1.5} />
      </div>
      <span className={`font-display ${textSize} font-medium tracking-wide text-cream`}>
        Déclic<span className="text-sand-300"> Studio</span>
      </span>
    </button>
  );
}
