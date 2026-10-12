import { useId } from 'react';

type LogoProps = {
  caption?: string;
};

export default function Logo({ caption }: LogoProps) {
  const gradientId = useId();

  return (
    <span className="inline-flex items-center gap-3">
      <svg
        className="w-9 h-9"
        viewBox="0 0 100 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M25 10C15 10 7 17 7 25C7 33 15 40 25 40C35 40 43 32 50 25C57 18 65 10 75 10C85 10 93 17 93 25C93 33 85 40 75 40C65 40 57 32 50 25C43 18 35 10 25 10Z"
          stroke={`url(#${gradientId})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D97706" />
            <stop offset="50%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
      </svg>

      {caption ? (
        <span className="flex flex-col">
          <span className="font-sans text-lg tracking-wider font-extrabold text-slate-900">
            TEA-PTS
          </span>
          <span className="text-[10px] text-slate-500">{caption}</span>
        </span>
      ) : (
        <span className="font-sans text-lg tracking-wider font-extrabold text-slate-900">
          TEA-PTS
        </span>
      )}
    </span>
  );
}
