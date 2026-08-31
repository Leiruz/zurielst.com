// Structural adapter for ncdai registry block "social-proof-01" (chanhdai.com/r, MIT).
// Adapted to compose the profile-owned Worked with brand carousel.
import type { ReactNode } from 'react';

interface SocialProof01Props {
  children: ReactNode;
}

export function SocialProof01({ children }: SocialProof01Props) {
  return (
    <div data-slot="social-proof-01" className="social-proof-01">
      {children}
    </div>
  );
}
