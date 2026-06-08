import * as vscode from 'vscode';
import { createGamePanel } from './host/gamePanel';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('neonJump.start', () => {
    createGamePanel(context);
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
