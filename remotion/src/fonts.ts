import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

loadFont({
  family: 'Geist',
  url: staticFile('fonts/geist-latin.woff2'),
  format: 'woff2',
  weight: '100 900',
});

loadFont({
  family: 'Geist Mono',
  url: staticFile('fonts/geist-mono-latin.woff2'),
  format: 'woff2',
  weight: '100 900',
});
