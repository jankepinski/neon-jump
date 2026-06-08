export type PlatformType = 'normal' | 'fragile' | 'moving';
export type GameMode = 'ready' | 'playing' | 'gameOver';

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: PlatformType;
  hitsLeft: number | null;
  vx?: number;
  minX?: number;
  maxX?: number;
}

export interface Player {
  x: number;
  y: number;
  previousY: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  alpha: number;
  r: number;
  g: number;
  b: number;
}

export interface TrailNode {
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
}

export interface VisualRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameState {
  mode: GameMode;
  score: number;
  highScore: number;
  cameraY: number;
  highestY: number;
  lastGeneratedRowY: number;
  lastRowWasEmpty: boolean;
  keys: { left: boolean; right: boolean };
  player: Player;
  platforms: Platform[];
}

export interface FxState {
  trail: TrailNode[];
  particles: Particle[];
  flash: number;
  shakeMag: number;
  shakeX: number;
  shakeY: number;
  squashImpulse: number;
  renderCameraY: number;
}

export interface ViewModel {
  logicalWidth: number;
  logicalHeight: number;
  cameraY: number;
  time: number;
  flash: number;
  shakeX: number;
  shakeY: number;
  fragileHits: number;
  score: string;
  scoreActive: boolean;
  record: boolean;
  platforms: Platform[];
  player: VisualRect;
  trail: TrailNode[];
  particles: Particle[];
}
