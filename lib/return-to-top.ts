export interface ReturnToTopControl {
  dataset: Record<string, string> | DOMStringMap;
  setAttribute(name: string, value: string): void;
  tabIndex: number;
  addEventListener(type: 'click', listener: () => void): void;
}

export interface ReturnToTopRuntime {
  readonly scrollY: number;
  readonly innerHeight: number;
  addEventListener(type: 'scroll', listener: () => void, options: { passive: true }): void;
  scrollTo(options: ScrollToOptions): void;
  matchMedia(query: string): { matches: boolean };
}

export function installReturnToTop(
  control: ReturnToTopControl | null,
  runtime: ReturnToTopRuntime = window,
) {
  if (!control) return;

  const sync = () => {
    const visible = runtime.scrollY > runtime.innerHeight;
    control.dataset.visible = String(visible);
    control.setAttribute('aria-hidden', String(!visible));
    control.tabIndex = visible ? 0 : -1;
  };
  runtime.addEventListener('scroll', sync, { passive: true });
  control.addEventListener('click', () => runtime.scrollTo({
    top: 0,
    behavior: runtime.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  }));
  sync();
}
