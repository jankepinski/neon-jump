import * as vscode from 'vscode';
import { HIGH_SCORE_KEY } from '../shared/protocol';

export function getHighScore(context: vscode.ExtensionContext): number {
  return context.globalState.get<number>(HIGH_SCORE_KEY, 0);
}

export async function updateHighScore(
  context: vscode.ExtensionContext,
  score: number
): Promise<void> {
  const currentHighScore = getHighScore(context);
  if (score > currentHighScore) {
    await context.globalState.update(HIGH_SCORE_KEY, Math.floor(score));
  }
}
