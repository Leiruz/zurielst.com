interface SectionAnchorProps {
  href: string;
  label: string;
}

export function SectionAnchor({ href, label }: SectionAnchorProps) {
  return (
    <a href={href} className="dossier-anchor" aria-label={`Link to the ${label} section`}>
      #
    </a>
  );
}
