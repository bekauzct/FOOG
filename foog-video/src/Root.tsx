import React from 'react';
import { Composition } from 'remotion';
import { DURATION, FoogiiFilms } from './FoogiiFilms';
import { FPS } from './lib';

export const Root: React.FC = () => (
  <Composition id="FoogiiFilms" component={FoogiiFilms} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
);
