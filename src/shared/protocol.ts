export const HIGH_SCORE_KEY = 'neonJump.highScore';

export interface GameOverMessage {
  type: 'gameOver';
  score: number;
}

export type WebviewToHostMessage = GameOverMessage;
