import 'server-only';

import { Metrics01 } from '@/components/registry/metrics-01';
import { ScrollFadeEffect } from '@/components/registry/scroll-fade-effect';
import type { AnalyticsSnapshot } from '@/lib/analytics-snapshot';

interface VisitorInsightsProps {
  data: AnalyticsSnapshot;
}

export function VisitorInsights({ data }: VisitorInsightsProps) {
  return (
    <section id="insights" className="dossier-section bg-canvas-raised" aria-labelledby="insights-title">
      <ScrollFadeEffect entrance className="dossier-shell min-w-0">
        <p className="fig-label">Fig. 13. Insights</p>
        <Metrics01 data={data} />
      </ScrollFadeEffect>
    </section>
  );
}
