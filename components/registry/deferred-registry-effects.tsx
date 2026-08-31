'use client';

import dynamic from 'next/dynamic';

const DeferredFluidGradientText = dynamic(
  () => import('@/components/registry/fluid-gradient-text').then((module) => module.FluidGradientText),
  {
    loading: () => <span className="dossier-display text-text-1">Zuriel</span>,
    ssr: false,
  },
);

export function DeferredFooterIdentityEffect() {
  return <DeferredFluidGradientText text="Zuriel" />;
}
