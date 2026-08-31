export interface ReturnToTopControl {
  dataset: Record<string, string> | DOMStringMap;
  blur(): void;
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

  let wasVisible = false;
  const sync = () => {
    const visible = runtime.scrollY > runtime.innerHeight;
    if (wasVisible && !visible) control.blur();
    control.dataset.visible = String(visible);
    control.setAttribute('aria-hidden', String(!visible));
    control.tabIndex = visible ? 0 : -1;
    wasVisible = visible;
  };
  runtime.addEventListener('scroll', sync, { passive: true });
  control.addEventListener('click', () => runtime.scrollTo({
    top: 0,
    behavior: runtime.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  }));
  sync();
}
