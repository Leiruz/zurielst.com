'use client';

import { useState } from 'react';
import { deriveInitials } from '@/lib/dossier';

interface PortraitAvatarProps {
  image: string;
  alt: string;
  name: string;
}

export function PortraitAvatar({ image, alt, name }: PortraitAvatarProps) {
  const [failed, setFailed] = useState(false);

  return (
    <>
      <img
        src={image}
        alt={alt}
        width={192}
        height={192}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        hidden={failed}
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
      <span hidden={!failed} role="img" aria-label={`${name} monogram`}>
        {deriveInitials(name)}
      </span>
    </>
  );
}
