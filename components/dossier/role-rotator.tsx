import type { CSSProperties } from 'react';

interface RoleRotatorProps {
  roles: readonly string[];
  className?: string;
}

interface RoleTrackStyle extends CSSProperties {
  '--role-count': number;
  '--role-duration': string;
}

export const ROLE_ROTATION_INTERVAL_MS = 3_000;

export function RoleRotator({ roles, className }: RoleRotatorProps) {
  const firstRole = roles[0];
  if (!firstRole) return null;

  const trackStyle: RoleTrackStyle = {
    '--role-count': roles.length,
    '--role-duration': `${roles.length * ROLE_ROTATION_INTERVAL_MS}ms`,
  };

  return (
    <span
      className={['role-rotator-viewport', className].filter(Boolean).join(' ')}
      aria-live="off"
    >
      <span className="sr-only">{firstRole}</span>
      <span aria-hidden="true" className="role-rotator-track" style={trackStyle}>
        {[...roles, firstRole].map((role, index) => (
          <span
            key={`${index}-${role}`}
            className="role-rotator-item role-light-up"
            data-role-rotation-key={index % roles.length}
          >
            {role}
          </span>
        ))}
      </span>
    </span>
  );
}
