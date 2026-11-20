interface LoadingDotsTextProps {
  text: string;
  className?: string;
}

/**
 * Renders a static loading label with animated trailing dots (1 -> 2 -> 3 -> 1)
 * and a native indeterminate <progress> element without announcing each tick.
 */
export function LoadingDotsText({ text, className = 'mono' }: LoadingDotsTextProps) {
  return (
    <>
      <progress className="visually-hidden" aria-label={text} />
      <span className={className || undefined}>
        {text}
        <span className="loading-dots" aria-hidden="true">
          <span>.</span>
          <span className="loading-dot-2">.</span>
          <span className="loading-dot-3">.</span>
        </span>
      </span>
    </>
  );
}
