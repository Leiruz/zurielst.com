export function getLoopProgress(frame: number, durationInFrames: number) {
  return durationInFrames <= 1 ? 0 : frame / (durationInFrames - 1);
}
