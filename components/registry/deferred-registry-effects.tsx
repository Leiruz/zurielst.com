'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

function FluidGradientTextFallback() {
  return (
    <span className="dossier-display flex h-full items-center justify-center text-text-1">
      Zuriel
    </span>
  );
}

const DeferredFluidGradientText = dynamic(
  () => import('@/components/registry/fluid-gradient-text').then((module) => module.FluidGradientText),
  {
    loading: FluidGradientTextFallback,
    ssr: false,
  },
);

export function DeferredFooterIdentityEffect() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      setIsNearViewport(true);
    }, { rootMargin: '256px 0px' });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      data-footer-identity-effect="true"
      className="mb-10 h-[clamp(5rem,14vw,10rem)] overflow-hidden"
    >
      {isNearViewport
        ? <DeferredFluidGradientText text="Zuriel" />
        : <FluidGradientTextFallback />}
    </div>
  );
}
