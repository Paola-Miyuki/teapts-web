const glyphs = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10H3Z" />
      <path d="M9 20v-7h6v7" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5v2" />
    </>
  ),
  patient: (
    <>
      <circle cx="10" cy="7" r="4" />
      <path d="M3 21v-2a7 7 0 0 1 10.5-6.06" />
      <path d="M18 21s-4-2.4-4-5.1a2 2 0 0 1 4-.9 2 2 0 0 1 4 .9c0 2.7-4 5.1-4 5.1Z" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6v3H9zM9 11h6m-6 4h6" />
    </>
  ),
  logout: <path d="M9 3H4v18h5M10 12h11m-4-4 4 4-4 4" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  eye: (
    <>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M13.36 13.36a3 3 0 0 1-4.72-4.72" />
      <path d="M2 12s3.6-6 10-6a9.97 9.97 0 0 1 5.97 1.94" />
      <path d="M22 12s-3.6 6-10 6a9.97 9.97 0 0 1-5.97-1.94" />
      <path d="m3 3 18 18" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9a2.4 2.4 0 0 1 4.8 0c0 2-2.4 2-2.4 4M12 16v1" />
    </>
  ),
  lock: (
    <>
      <rect x="6" y="10" width="12" height="10" rx="2" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
      <path d="M12 14v2" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 6 6" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  alertCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 17h.01" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  plus: <path d="M12 4v16M4 12h16" />,
  trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
};

export type IconName = keyof typeof glyphs;

type IconProps = {
  name: IconName;
  className?: string;
};

export default function Icon({ name, className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyphs[name]}
    </svg>
  );
}
