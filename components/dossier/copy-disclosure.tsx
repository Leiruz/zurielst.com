interface CopyDisclosureProps {
  className?: string;
  id: string;
  kind: 'capability' | 'work' | 'timeline';
  paragraphClassName: string;
  text: string;
}

export function CopyDisclosure({
  className,
  id,
  kind,
  paragraphClassName,
  text,
}: CopyDisclosureProps) {
  return (
    <details
      data-copy-disclosure={kind}
      data-copy-id={id}
      className={['copy-disclosure group mt-3 min-w-0', className].filter(Boolean).join(' ')}
    >
      <summary
        aria-expanded="false"
        className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm py-1 font-mono text-xs text-text-2 transition-colors duration-150 hover:text-text-1 focus-visible:ring-2 focus-visible:ring-ring/50 marker:content-none [&::-webkit-details-marker]:hidden"
      >
        <span className="copy-disclosure-more">Read more</span>
        <span className="copy-disclosure-less">Read less</span>
        <svg
          aria-hidden="true"
          className="copy-disclosure-chevron size-3.5"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
      </summary>
      <div className="copy-disclosure-content">
        <p className={paragraphClassName}>{text}</p>
      </div>
    </details>
  );
}
