import { SectionAnchor } from '@/components/dossier/section-anchor';
import { ScrollFadeEffect } from '@/components/registry/scroll-fade-effect';
import {
  Testimonial,
  TestimonialAuthor,
  TestimonialAuthorName,
  TestimonialAuthorTagline,
  TestimonialQuote,
} from '@/components/registry/testimonial';
import { TestimonialsMarquee } from '@/components/registry/testimonials-marquee';
import testimonialData from '@/content/testimonials.json';

interface TestimonialEntry {
  id: string;
  name: string;
  quote: string;
  role: string;
}

const testimonials = testimonialData as TestimonialEntry[];

function TestimonialCard({ entry, primary }: { entry: TestimonialEntry; primary: boolean }) {
  return (
    <Testimonial
      data-testimonial-primary={primary ? 'true' : undefined}
      className="w-[min(36rem,calc(100vw-3rem))]"
    >
      <TestimonialQuote>{entry.quote}</TestimonialQuote>
      <TestimonialAuthor>
        <TestimonialAuthorName>{entry.name}</TestimonialAuthorName>
        <TestimonialAuthorTagline>{entry.role}</TestimonialAuthorTagline>
      </TestimonialAuthor>
    </Testimonial>
  );
}

export function Testimonials() {
  return (
    <section id="testimonials" className="dossier-section bg-canvas-raised" aria-labelledby="testimonials-title">
      <div className="dossier-shell min-w-0">
        <ScrollFadeEffect entrance>
          <p className="fig-label">Fig. 13. Testimonials</p>
          <h2 id="testimonials-title" className="dossier-title mt-4 text-text-1">
            Testimonials <SectionAnchor href="#testimonials" label="testimonials" />
          </h2>
        </ScrollFadeEffect>

        <ScrollFadeEffect entrance className="mt-10">
          <TestimonialsMarquee
            duplicateChildren={testimonials.map((entry) => (
              <TestimonialCard key={`duplicate-${entry.id}`} entry={entry} primary={false} />
            ))}
          >
            {testimonials.map((entry) => (
              <TestimonialCard key={entry.id} entry={entry} primary />
            ))}
          </TestimonialsMarquee>
        </ScrollFadeEffect>
      </div>
    </section>
  );
}
