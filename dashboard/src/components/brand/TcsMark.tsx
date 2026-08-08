type TcsMarkProps = {
  className?: string;
  decorative?: boolean;
  size?: number;
};

export function TcsMark({ className, decorative = false, size = 42 }: TcsMarkProps) {
  return (
    <span
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'TCS — Relatório de Risco'}
      className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ''}`}
      role={decorative ? undefined : 'img'}
      style={{ height: size, width: size }}
    >
      <img alt="" className="h-full w-full object-contain" src="/tcs-system-logo.png" />
    </span>
  );
}
