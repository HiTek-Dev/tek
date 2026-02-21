interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 16,
  md: 24,
  lg: 32,
};

export function Spinner({ size = 'md' }: SpinnerProps) {
  const px = sizes[size];
  return (
    <svg
      className="animate-spin text-brand-400"
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
