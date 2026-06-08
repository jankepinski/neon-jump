import * as vscode from 'vscode';
import type { WebviewToHostMessage } from '../shared/protocol';
import { getHighScore, updateHighScore } from './highScore';
import { getWebviewHtml } from './webviewHtml';

export function createGamePanel(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel(
    'neonJump',
    'Neon Jump',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'media'),
        vscode.Uri.joinPath(context.extensionUri, 'out')
      ]
    }
  );

  const highScore = getHighScore(context);
  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, highScore);

  panel.webview.onDidReceiveMessage(async (message: WebviewToHostMessage) => {
    if (message?.type !== 'gameOver') {
      return;
    }

    const score = Number(message.score);
    if (!Number.isFinite(score)) {
      return;
    }

    await updateHighScore(context, score);
  });
}
