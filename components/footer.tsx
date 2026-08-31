import { FooterTerminalTrigger } from '@/components/footer-terminal-trigger';
import { DeferredFooterIdentityEffect } from '@/components/registry/deferred-registry-effects';
import { BUILD_DATE, BUILD_SHA } from '@/lib/build-info';

interface FooterProps {
  buildDate?: string;
  buildSha?: string;
  name: string;
}

const linkClassName = 'underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-1';

export function Footer({
  buildDate = BUILD_DATE,
  buildSha = BUILD_SHA,
  name,
}: FooterProps) {
  const buildDay = buildDate.slice(0, 10);
  const buildYear = buildDay.slice(0, 4);
  const commitUrl = `https://github.com/Leiruz/zurielst.com/commit/${buildSha}`;
  const isCommitSha = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(buildSha);
  const buildLabel = isCommitSha ? buildSha.slice(0, 7) : buildSha;

  return (
    <footer className="border-t border-line bg-canvas py-10">
      <div className="dossier-shell">
        <div className="mb-10 h-[clamp(5rem,14vw,10rem)] overflow-hidden" data-footer-identity-effect="true">
          <DeferredFooterIdentityEffect />
        </div>
        <div className="grid gap-8 font-mono text-xs text-text-3 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <div className="space-y-2">
            <p>© {buildYear} {name}. <FooterTerminalTrigger /></p>
            <p><a href="/media/resume.pdf" className={linkClassName}>Resume</a></p>
            <p>Built with components from <a href="https://chanhdai.com" target="_blank" rel="noopener noreferrer" className={linkClassName}>ncdai&apos;s registry (MIT)</a></p>
          </div>

          <div>
            <p className="dossier-eyebrow">DOCUMENT CONTROL</p>
            <dl className="mt-3 border-t border-line">
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-line py-2.5">
                <dt>BUILD</dt>
                <dd className="min-w-0 text-text-1">
                  {isCommitSha ? (
                    <a href={commitUrl} target="_blank" rel="noopener noreferrer" className={linkClassName}>{buildLabel}</a>
                  ) : buildLabel}
                </dd>
              </div>
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-line py-2.5">
                <dt>DATE</dt>
                <dd className="min-w-0 text-text-1"><time dateTime={buildDay}>{buildDay}</time></dd>
              </div>
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-line py-2.5">
                <dt>DEPLOYED ON</dt>
                <dd className="min-w-0 text-text-1">Cloudflare Workers</dd>
              </div>
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-line py-2.5">
                <dt>SOURCE</dt>
                <dd className="min-w-0 text-text-1"><a href="https://github.com/Leiruz/zurielst.com" target="_blank" rel="noopener noreferrer" className={linkClassName}>GitHub</a></dd>
              </div>
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-line py-2.5">
                <dt>LICENSE</dt>
                <dd className="min-w-0 text-text-1">MIT</dd>
              </div>
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-line py-2.5">
                <dt>TYPEFACES</dt>
                <dd className="min-w-0 text-text-1">Geist and Geist Mono</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </footer>
  );
}
