export interface ParsedMetric {
  value: number;
  prefix: string;
  suffix: string;
  fractionDigits: number;
}

export interface DisclosureCopySplit {
  teaser: string;
  remainder: string;
}

const METRIC_PATTERN = /^(.*?)(\d+(?:\.(\d+))?)(.*)$/;
const SENTENCE_BOUNDARY_PATTERN = /[.!?](?:["')\]]+)?(?=\s|$)/g;
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

export function formatVisitorRelativeOffset(
  timezone: string,
  visitorOffsetMinutes: number,
) {
  const deltaMinutes = parseUtcOffset(timezone).hours * 60 + visitorOffsetMinutes;
  if (deltaMinutes === 0) return 'same time as you';

  const absoluteMinutes = Math.abs(deltaMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  const duration = [hours ? `${hours}h` : '', minutes ? `${minutes}m` : '']
    .filter(Boolean)
    .join(' ');

  return deltaMinutes > 0
    ? `${duration} ahead of you`
    : `${duration} behind you`;
}

export function deriveInitials(name: string): string {
  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  const firstInitial = nameParts[0]?.[0] ?? '';
  const lastInitial = nameParts.length > 1 ? nameParts.at(-1)?.[0] ?? '' : '';

  return `${firstInitial}${lastInitial}`.toUpperCase();
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
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

export function splitDisclosureCopy(text: string, approximateLimit: number): DisclosureCopySplit {
  if (text.length <= approximateLimit) {
    return { teaser: text, remainder: '' };
  }

  const firstTwoBoundaries = Array.from(text.matchAll(SENTENCE_BOUNDARY_PATTERN), (match) => (
    (match.index ?? 0) + match[0].length
  )).slice(0, 2);
  const lastBoundaryWithinLimit = firstTwoBoundaries
    .filter((boundary) => boundary <= approximateLimit)
    .at(-1);
  const splitAt = lastBoundaryWithinLimit
    ?? firstTwoBoundaries.find((boundary) => boundary > approximateLimit);

  if (splitAt === undefined) {
    return { teaser: text, remainder: '' };
  }

  return {
    teaser: text.slice(0, splitAt).trimEnd(),
    remainder: text.slice(splitAt).trimStart(),
  };
}
