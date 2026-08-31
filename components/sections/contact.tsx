import { SectionAnchor } from '@/components/dossier/section-anchor';
import type { Social } from '@/content/schema';
import { withSiteUtm } from '@/lib/outbound-links';

export function ContactAssistantButton() {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-controls="dossier-chat-dialog"
      data-chat-open
      className="contact-assistant-trigger"
    >
      Ask the assistant
    </button>
  );
}

interface ContactProps {
  email: string;
  socials: Social[];
}

export function Contact({ email, socials }: ContactProps) {
  return (
    <section id="contact" className="dossier-section bg-canvas" aria-labelledby="contact-title">
      <div className="dossier-shell">
        <p className="fig-label">Fig. 13. Contact</p>
        <h2 id="contact-title" className="dossier-title mt-4 text-text-1">
          The dossier is open. <SectionAnchor href="#contact" label="contact" />
        </h2>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={`mailto:${email}`}
            className="contact-email-link"
          >
            {email}
          </a>
          <button
            type="button"
            data-copy-email={email}
            aria-describedby="contact-copy-status"
            className="contact-copy-button"
          >
            Copy email
          </button>
          <span
            id="contact-copy-status"
            data-copy-email-status
            className="font-mono text-xs text-text-3"
            role="status"
            aria-live="polite"
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {socials.map((social) => (
            <a
              key={social.platform}
              href={withSiteUtm(social.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="contact-social-link"
            >
              {social.platform} ↗
            </a>
          ))}
          <a href="/zurielst.vcf" download className="contact-social-link">
            vCard ↓
          </a>
        </div>

        <div className="mt-10 border-t border-line pt-5">
          <ContactAssistantButton />
        </div>
      </div>
    </section>
  );
}
