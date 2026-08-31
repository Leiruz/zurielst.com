// Delegated adapter for ncdai registry item "haptic" (chanhdai.com/r, MIT).
// Divergences are recorded in docs/components-map.md.
'use client';

import { useEffect } from 'react';

import { haptic } from '@/lib/haptic';

interface HapticTarget {
  closest?(selector: string): unknown;
}

interface HapticFeedbackRoot {
  addEventListener(
    type: 'click',
    listener: (event: { target: HapticTarget | null }) => void,
  ): void;
  removeEventListener(
    type: 'click',
    listener: (event: { target: HapticTarget | null }) => void,
  ): void;
}

export function installHapticFeedback(
  root: HapticFeedbackRoot,
  trigger: () => void = haptic,
) {
  const onClick = (event: { target: HapticTarget | null }) => {
    const target = event.target;
    if (typeof target?.closest !== 'function') return;
    if (target.closest('[data-haptic]')) trigger();
  };

  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}

export function HapticFeedback() {
  useEffect(() => installHapticFeedback(document), []);
  return null;
}
