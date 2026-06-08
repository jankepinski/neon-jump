export const KIND = {
  normal: 0,
  fragile: 1,
  moving: 2,
  player: 3,
  particle: 4,
  trail: 5
} as const;

export const PALETTE = {
  normal: [0.15, 0.92, 1.0],
  movingTrack: [0.12, 0.7, 0.45],
  moving: [0.25, 1.0, 0.55],
  player: [1.0, 0.32, 0.72],
  fragile3: [0.76, 0.52, 1.0],
  fragile2: [0.99, 0.6, 0.26],
  fragile1: [0.96, 0.28, 0.32]
} as const;

export const GLOW = {
  normal: 1.1,
  movingTrack: 0.6,
  moving: 1.3,
  player: 1.3,
  fragile3: 1.3,
  fragile2: 1.3,
  fragile1: 1.3
} as const;

export const WHITE = {
  normal: 0,
  movingTrack: 0,
  moving: 0,
  player: 0.4,
  fragile3: 0,
  fragile2: 0,
  fragile1: 0
} as const;

export function fragileColor(hitsLeft: number): readonly [number, number, number] {
  if (hitsLeft >= 3) {
    return PALETTE.fragile3;
  }
  if (hitsLeft === 2) {
    return PALETTE.fragile2;
  }
  return PALETTE.fragile1;
}

export function fragileGlow(hitsLeft: number): number {
  if (hitsLeft >= 3) {
    return GLOW.fragile3;
  }
  if (hitsLeft === 2) {
    return GLOW.fragile2;
  }
  return GLOW.fragile1;
}

export function fragileWhite(hitsLeft: number): number {
  if (hitsLeft >= 3) {
    return WHITE.fragile3;
  }
  if (hitsLeft === 2) {
    return WHITE.fragile2;
  }
  return WHITE.fragile1;
}
