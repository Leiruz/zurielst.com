import { Composition, Still } from 'remotion';
import { CardLoop } from './card-loop';
import { HeroLoop } from './hero-loop';
import { OgCard } from './og-card';

export function RemotionRoot() {
  return (
    <>
      <Still id="og-card" component={OgCard} width={1200} height={630} />
      <Composition id="hero-loop" component={HeroLoop} durationInFrames={210} fps={30} width={640} height={360} />
      <Composition id="card-loop" component={CardLoop} durationInFrames={180} fps={30} width={640} height={360} />
    </>
  );
}
