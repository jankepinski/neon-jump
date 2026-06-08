import * as vscode from 'vscode';

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  highScore: number
): string {
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'game.css'));
  const webviewUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'webview.js')
  );
  const nonce = getNonce();
  const safeHighScore = Math.floor(highScore);
  const paddedHighScore = String(safeHighScore).padStart(6, '0');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link href="${styleUri}" rel="stylesheet">
  <title>Neon Jump</title>
</head>
<body>
  <main id="app">
    <div id="stage">
      <canvas id="game" width="480" height="720" tabindex="0" aria-label="Neon Jump"></canvas>
      <div id="frame"></div>
      <section id="overlay" data-mode="ready">
        <div id="center">
          <div id="start-screen" class="panel">
            <h1 class="title glitch" data-text="NEON JUMP">Neon Jump</h1>
            <div class="panel-bottom">
              <p class="prompt">Press <kbd>Space</kbd> to start</p>
              <p class="hint">Move with Arrows or A / D</p>
            </div>
          </div>
          <div id="gameover-screen" class="panel">
            <h1 class="title danger glitch" data-text="GAME OVER">Game Over</h1>
            <div id="result">
              <div class="result-row score"><span class="result-label">Score</span><span id="final-score" class="result-value">000000</span></div>
              <div class="result-row best"><span class="result-label">Best</span><span id="final-best" class="result-value">${paddedHighScore}</span></div>
            </div>
            <p id="message" class="prompt panel-bottom">Press Space to restart</p>
          </div>
          <div id="error-screen" class="panel">
            <h1 class="title danger">No WebGL2</h1>
            <p class="hint">This game needs WebGL2 support.</p>
          </div>
        </div>
      </section>
    </div>
  </main>
  <script nonce="${nonce}">
    window.__INITIAL_STATE__ = { highScore: ${safeHighScore} };
  </script>
  <script nonce="${nonce}" src="${webviewUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';

  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}
