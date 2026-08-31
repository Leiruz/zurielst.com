export function getLoopProgress(frame: number, durationInFrames: number) {
  // frame / N, not frame / (N - 1): with N - 1 the final frame reaches
  // progress 1, which for periodic motion equals progress 0, so the loop
  // held a duplicated frame at the seam. With N the last rendered frame
  // sits one step short of the cycle and playback wraps seamlessly.
  return durationInFrames <= 0 ? 0 : frame / durationInFrames;
}
