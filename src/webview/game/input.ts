import type { GameState } from '../types';

export function installInput(state: GameState, onStartPressed: () => void): void {
  window.addEventListener('keydown', (event) => {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
      state.keys.left = true;
      event.preventDefault();
    }

    if (event.code === 'ArrowRight' || event.code === 'KeyD') {
      state.keys.right = true;
      event.preventDefault();
    }

    if (event.code === 'Space') {
      if (state.mode === 'ready' || state.mode === 'gameOver') {
        onStartPressed();
      }
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
      state.keys.left = false;
      event.preventDefault();
    }

    if (event.code === 'ArrowRight' || event.code === 'KeyD') {
      state.keys.right = false;
      event.preventDefault();
    }
  });
}
