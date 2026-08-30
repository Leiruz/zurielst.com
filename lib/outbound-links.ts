export function withSiteUtm(value: string) {
  const url = new URL(value);
  url.searchParams.set('utm_source', 'zurielst.com');
  return url.toString();
}
