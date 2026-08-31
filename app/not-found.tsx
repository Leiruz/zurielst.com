import { NotFoundGameLoader } from '@/components/registry/not-found-game-loader';

export default function NotFound() {
  return (
    <>
      <title>Page Not Found</title>
      <main className="bp-grid flex min-h-screen items-center bg-canvas py-16 text-text-1" aria-labelledby="not-found-title">
        <div className="dossier-shell">
          <div className="mx-auto max-w-4xl border border-line-strong bg-surface">
            <div className="bp-hatch h-8 border-b border-line" aria-hidden="true" />
            <div className="p-6 sm:p-10">
              <p className="dossier-eyebrow">FIG. 404. MISSING DOCUMENT</p>
              <p
                className="not-found-mark mt-5"
                data-not-found-mark="true"
                aria-label="ZST"
              >
                ZST
              </p>
              <h1 id="not-found-title" className="dossier-title mt-5">
                The requested record is absent.
              </h1>
              <p className="dossier-prose mt-4 text-text-2">
                Check the address or return to the public dossier index.
              </p>

              <div
                aria-hidden="true"
                className="not-found-redactions my-8"
                data-redaction-bar="true"
              />

              <dl className="border-t border-line font-mono text-xs">
                {[
                  ['REFERENCE', '404'],
                  ['STATUS', 'DOCUMENT NOT LOCATED'],
                  ['ROUTING', 'UNRESOLVED'],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[7rem_minmax(0,1fr)] border-b border-line py-3">
                    <dt className="text-text-3">{label}</dt>
                    <dd className="text-text-1">{value}</dd>
                  </div>
                ))}
              </dl>

              <a
                href="/"
                className="mt-8 inline-flex border border-line-strong bg-canvas px-4 py-2 font-mono text-xs text-text-1 transition-colors duration-150 hover:bg-surface-hover"
              >
                Return to the dossier
              </a>

              <NotFoundGameLoader />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
