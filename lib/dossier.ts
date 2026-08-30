export type ContributionHeatBucket = 0 | 1 | 2 | 3 | 4;

export interface ParsedMetric {
  value: number;
  prefix: string;
  suffix: string;
  fractionDigits: number;
}

const METRIC_PATTERN = /^(.*?)(\d+(?:\.(\d+))?)(.*)$/;
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface SingaporeClock {
  display: string;
  dateTime: string;
  accessibleLabel: string;
}

export function formatSingaporeClock(date: Date): SingaporeClock {
  const singaporeIso = new Date(date.getTime() + SINGAPORE_OFFSET_MS).toISOString();
  const singaporeDate = singaporeIso.slice(0, 10);
  const time = singaporeIso.slice(11, 19);
  const display = `+08 ${time}`;

  return {
    display,
    dateTime: `${singaporeDate}T${time}+08:00`,
    accessibleLabel: `Current time in Singapore: ${display}`,
  };
}

export function parseMetric(metric: string): ParsedMetric | null {
  const match = metric.match(METRIC_PATTERN);

  if (!match) return null;

  const [, prefix, numericValue, fraction = '', suffix] = match;

  return {
    value: Number(numericValue),
    prefix,
    suffix,
    fractionDigits: fraction.length,
  };
}

export function contributionHeatBucket(count: number): ContributionHeatBucket {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}
