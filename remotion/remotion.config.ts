import { Config } from '@remotion/cli/config';

Config.overrideFfmpegCommand(({ args, type }) => {
  if (type !== 'stitcher' || !args.includes('libx264')) return args;

  const output = args.at(-1);
  if (!output) return args;

  return [
    ...args.slice(0, -1),
    '-x264-params',
    'colorprim=bt709:transfer=bt709:colormatrix=bt709',
    output,
  ];
});
