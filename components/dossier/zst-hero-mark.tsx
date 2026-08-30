export function ZstHeroMark() {
  return (
    <a
      data-zst-hero-mark="true"
      href="#identity"
      aria-label="Return to top"
      className="group hidden self-center rounded-sm text-line-strong opacity-40 transition-opacity duration-150 hover:opacity-70 xl:flex motion-reduce:transition-none"
    >
      <svg
        aria-hidden="true"
        data-zst-line-art="true"
        focusable="false"
        viewBox="0 0 330 280"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="zst-blueprint-line-art h-auto w-full"
      >
        <g
          transform="translate(28 168) skewY(-30)"
        >
          <g opacity="0.45" transform="translate(12 12)">
            <path d="M0 0H70L0 90H70" />
            <path d="M160 0H90V45H160V90H90" />
            <path d="M180 0H270M225 0V90" />
          </g>

          <path d="M0 0H70L0 90H70" />
          <path d="M160 0H90V45H160V90H90" />
          <path d="M180 0H270M225 0V90" />

          <path d="M0 0 12 12M70 0 82 12M0 90 12 102M70 90 82 102" opacity="0.65" />
          <path d="M90 0 102 12M160 0 172 12M90 45 102 57M160 45 172 57M90 90 102 102M160 90 172 102" opacity="0.65" />
          <path d="M180 0 192 12M225 0 237 12M270 0 282 12M225 90 237 102" opacity="0.65" />
        </g>

        <path d="M18 264H312" strokeDasharray="4 6" opacity="0.45" />
        <path d="M18 258V270M312 258V270" opacity="0.6" />
      </svg>
    </a>
  );
}
