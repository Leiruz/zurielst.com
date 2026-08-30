export type ContributionHeatBucket = 0 | 1 | 2 | 3 | 4;

export interface ParsedMetric {
  value: number;
  prefix: string;
  suffix: string;
  fractionDigits: number;
}

const METRIC_PATTERN = /^(.*?)(\d+(?:\.(\d+))?)(.*)$/;
const UTC_OFFSET_PATTERN = /^UTC([+-])(\d{1,2})$/;
const HOUR_MS = 60 * 60 * 1000;

export interface ClockLocation {
  city: string;
  timezone: string;
}

export interface LocationClock {
  display: string;
  dateTime: string;
  accessibleLabel: string;
}

interface UtcOffset {
  hours: number;
  label: string;
}

function parseUtcOffset(timezone: string): UtcOffset {
  const match = timezone.match(UTC_OFFSET_PATTERN);

  if (!match) throw new Error(`Unsupported UTC offset: ${timezone}`);

  const [, sign, rawHours] = match;
  const absoluteHours = Number(rawHours);
  if (absoluteHours > 23) throw new Error(`Unsupported UTC offset: ${timezone}`);

  return {
    hours: (sign === '-' ? -1 : 1) * absoluteHours,
    label: `${sign}${rawHours.padStart(2, '0')}`,
  };
}

export function formatLocationClock(date: Date, location: ClockLocation): LocationClock {
  const offset = parseUtcOffset(location.timezone);
  const localIso = new Date(date.getTime() + offset.hours * HOUR_MS).toISOString();
  const localDate = localIso.slice(0, 10);
  const time = localIso.slice(11, 19);
  const display = `${time} ${offset.label}`;

  return {
    display,
    dateTime: `${localDate}T${time}${offset.label}:00`,
    accessibleLabel: `Current time in ${location.city}: ${display}`,
  };
}

export function createLocationClockFallback(location: ClockLocation) {
  const { label } = parseUtcOffset(location.timezone);
  const display = `--:--:-- ${label}`;

  return {
    display,
    accessibleLabel: `Current time in ${location.city}: ${display}`,
  };
}

export function deriveInitials(name: string): string {
  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  const firstInitial = nameParts[0]?.[0] ?? '';
  const lastInitial = nameParts.length > 1 ? nameParts.at(-1)?.[0] ?? '' : '';

  return `${firstInitial}${lastInitial}`.toUpperCase();
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
