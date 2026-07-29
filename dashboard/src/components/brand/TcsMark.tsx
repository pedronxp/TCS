type TcsMarkProps = {
  className?: string;
  decorative?: boolean;
  size?: number;
};

export function TcsMark({ className, decorative = false, size = 42 }: TcsMarkProps) {
  return (
    <svg
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'TCS — Gestão Territorial'}
      className={className}
      height={size}
      role={decorative ? undefined : 'img'}
      viewBox="0 0 42 42"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="42" height="42" rx="12" fill="#D7C3AA" />
      <text
        x="21"
        y="28"
        fill="#6F513A"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="20"
        fontWeight="700"
        textAnchor="middle"
      >
        T
      </text>
    </svg>
  );
}
