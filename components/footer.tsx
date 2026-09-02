import type { ReactNode } from 'react';

import { FooterTerminalTrigger } from '@/components/footer-terminal-trigger';
import { FooterPrivacyChoices } from '@/components/footer-privacy-choices';
import { DeferredFooterIdentityEffect } from '@/components/registry/deferred-registry-effects';
import type { Social } from '@/content/schema';
import { BUILD_DATE, BUILD_SHA } from '@/lib/build-info';
import { withSiteUtm } from '@/lib/outbound-links';
import packageJson from '@/package.json';

interface FooterProps {
  buildDate?: string;
  buildSha?: string;
  socials: readonly Social[];
}

interface ColophonCellProps {
  children: ReactNode;
  className?: string;
  label: string;
}

const linkClassName = [
  'rounded-sm underline decoration-line-strong underline-offset-4',
  'transition-colors duration-150 hover:text-text-1 motion-reduce:transition-none',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
].join(' ');

const stackVersions = [
  ['next', packageJson.dependencies.next],
  ['react', packageJson.dependencies.react],
  ['tailwindcss', packageJson.devDependencies.tailwindcss],
] as const;

function displayVersion(version: string) {
  return version.replace(/^[^\d]*/, '');
}

export function Footer({
  buildDate = BUILD_DATE,
  buildSha = BUILD_SHA,
  socials,
}: FooterProps) {
  const buildDay = buildDate.slice(0, 10);
  const commitUrl = `https://github.com/Leiruz/zurielst.com/commit/${buildSha}`;
  const isCommitSha = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(buildSha);
  const buildLabel = isCommitSha ? buildSha.slice(0, 7) : buildSha;

  return (
    <footer className="border-t border-line bg-canvas py-10 sm:py-14">
      <div className="dossier-shell">
        <DeferredFooterIdentityEffect />
        <div data-colophon="true" className="border-l border-t border-line font-mono text-xs text-text-3">
          <div data-colophon-title-row="true" className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div className="min-w-0 border-b border-r border-line p-5 sm:p-6">
              <p className="text-base font-semibold tracking-tight text-text-1 sm:text-lg">zurielst.com</p>
            </div>
            <div className="min-w-0 border-b border-r border-line p-5 sm:p-6">
              <p className="leading-5 text-text-2 lg:whitespace-nowrap">
                An engineered dossier for AI and automation in security.
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <ColophonCell label="CRAFTED BY">
              <a
                href="https://github.com/Leiruz"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClassName}
              >
                @Leiruz
              </a>
            </ColophonCell>
            <ColophonCell label="BUILD">
              {isCommitSha ? (
                <a
                  href={commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClassName}
                >
                  {buildLabel}
                </a>
              ) : buildLabel}
            </ColophonCell>
            <ColophonCell label="DATE">
              <time dateTime={buildDay}>{buildDay}</time>
            </ColophonCell>
            <ColophonCell label="SOURCE CODE">
              <a
                href="https://github.com/Leiruz/zurielst.com"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClassName}
              >
                GitHub
              </a>
            </ColophonCell>
            <ColophonCell label="STACK" className="sm:col-span-2">
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {stackVersions.map(([name, version]) => (
                  <li key={name}>{name}@{displayVersion(version)}</li>
                ))}
              </ul>
            </ColophonCell>
            <ColophonCell label="TYPEFACE">Geist</ColophonCell>
            <ColophonCell label="ANALYTICS">Cloudflare Web Analytics</ColophonCell>
          </dl>

          <div data-colophon-bottom-row="true" className="grid grid-cols-1 sm:grid-cols-2">
            <div className="flex min-h-16 items-center border-b border-r border-line px-5 sm:px-6">
              <FooterTerminalTrigger />
            </div>

            <div className="flex min-h-16 items-center justify-between gap-3 border-b border-r border-line px-3 sm:px-4">
              <FooterPrivacyChoices />
              <div className="flex items-center gap-1">
                {socials.map((social) => (
                  <a
                    key={social.platform}
                    href={withSiteUtm(social.url)}
                    target="_blank"
                    rel="me noopener"
                    aria-label={social.platform}
                    data-footer-social="true"
                    className="inline-flex size-11 items-center justify-center rounded-sm text-text-2 transition-colors duration-150 hover:bg-surface-hover hover:text-text-1 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  >
                    <SocialIcon platform={social.platform} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function ColophonCell({ children, className, label }: ColophonCellProps) {
  return (
    <div
      data-colophon-cell="true"
      className={['min-w-0 border-b border-r border-line p-5 sm:p-6', className]
        .filter(Boolean)
        .join(' ')}
    >
      <dt data-colophon-label="true" className="dossier-eyebrow">{label}</dt>
      <dd className="mt-3 min-w-0 break-words leading-5 text-text-1">{children}</dd>
    </div>
  );
}

function SocialIcon({ platform }: { platform: Social['platform'] }) {
  if (platform === 'GitHub') {
    return (
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7.4A5.8 5.8 0 0 0 19.3 3 5.4 5.4 0 0 0 19.1 1S17.9.6 15 2.5a14 14 0 0 0-7 0C5.1.6 3.9 1 3.9 1a5.4 5.4 0 0 0-.2 2A5.8 5.8 0 0 0 2.2 7.1c0 5.8 3.5 7 6.8 7.4A4.8 4.8 0 0 0 8 18v4" />
        <path d="M8 19c-3 .9-3-1.5-4.2-2" />
      </svg>
    );
  }

  if (platform === 'Instagram') {
    return (
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17.5 6.5h.01" strokeWidth="2.5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" />
      <path d="M2 9h4v12H2z" />
      <path d="M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </svg>
  );
}
