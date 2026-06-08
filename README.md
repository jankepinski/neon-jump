<div align="center">

# ⛧ NEON JUMP

**A neon-cyberpunk vertical jumper that lives inside your editor.**

Bounce up an endless synthwave skyline, drawn frame-by-frame by a hand-written
WebGL2 pipeline — SDF neon platforms, HDR bloom, a perspective grid, chromatic
aberration, CRT curvature, scanlines and grain. No game engine. Zero runtime
dependencies.

[![CI](https://github.com/jankepinski/neon-jump/actions/workflows/ci.yml/badge.svg)](https://github.com/jankepinski/neon-jump/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-7c3aed.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.90-007ACC?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
[![Cursor](https://img.shields.io/badge/Cursor-ready-46e6ff)](https://cursor.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![WebGL2](https://img.shields.io/badge/WebGL2-no%20dependencies-ff3bd4)](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext)

`Space` to jump in · `←/→` or `A/D` to move · don't fall.

</div>

---

## Why

It's the classic "jump forever, don't fall" arcade loop — but every pixel is
rendered by a custom WebGL2 renderer running inside a VS Code / Cursor webview.
It's a love letter to synthwave and a compact showcase of real-time graphics
techniques in ~1k lines of dependency-free JavaScript.

## Features

- **Hand-written WebGL2 renderer** — no Three.js, no Pixi, no game engine. Just
  GLSL ES 3.00, an instanced rounded-rect batcher, and framebuffer ping-pong.
- **HDR bloom** — bright-pass → separable Gaussian blur ping-pong → additive
  composite, with filmic tone mapping for natural neon roll-off.
- **Signed-distance-field entities** — platforms, player, particles and trail
  are all anti-aliased SDF rounded boxes with crisp neon edges and outer glow.
- **Procedural synthwave background** — animated perspective grid, a scanline
  sun, twinkling stars and drifting light cells, all in a single fragment shader.
- **Your score, baked into the sun** — the live score is rasterized to a texture
  and clipped into the sun's body so it inherits the same bloom and CRT post-FX.
- **CRT post-processing** — barrel curvature, radial chromatic aberration,
  scanlines, vignette and film grain in the composite pass.
- **Game feel / juice** — squash & stretch, a fading motion trail, particle
  bursts on every bounce, screen shake and a hit-flash.
- **Three platform types** with distinct behaviour, plus persistent local
  high-score tracking handled by the extension host.

## Install & run (from source)

```bash
git clone https://github.com/jankepinski/neon-jump.git
cd neon-jump
npm install
```

Open the folder in **VS Code** or **Cursor** and press <kbd>F5</kbd> to launch
an Extension Development Host. In that new window, open the Command Palette
(<kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) and run:

```text
Neon Jump: Start
```

> Requires a WebGL2-capable environment. VS Code and Cursor both qualify; if
> WebGL2 is unavailable the game shows a graceful fallback message.

### Package as a `.vsix`

```bash
npm run package   # uses @vscode/vsce
code --install-extension neon-jump-0.1.0.vsix
```

## Controls

| Key | Action |
| --- | --- |
| <kbd>Space</kbd> | Start / restart |
| <kbd>←</kbd> / <kbd>→</kbd> | Move left / right |
| <kbd>A</kbd> / <kbd>D</kbd> | Move left / right |

You wrap around the screen edges. Touching the bottom edge ends the run.

## How to play

Jump as high as you can — the score is your altitude. Platforms spawn on a fixed
vertical grid sized to your jump height (clearing one empty row costs about 0.9
of a full jump).

| Platform | Colour | Behaviour |
| --- | --- | --- |
| **Stable** | cyan | Never breaks. (~50% of platforms) |
| **Fragile** | violet → amber → red | Breaks after 3 bounces; colour warns you. (~25%) |
| **Moving** | green | Slides along a glowing rail. (~25%) |

About 40% of rows are intentionally empty, and ~5% of populated rows spawn a
second platform alongside the first. Your best score is stored locally by the
extension and shown on the game-over screen.

## Architecture

The extension host is tiny: it opens a webview and persists the high score. All
the real work happens in the browser-side rendering pipeline.

```text
src/extension.ts        Extension host — creates the webview panel,
                        injects the HTML, persists the high score.

media/                  Webview runtime (plain JS/CSS, shipped as-is — not compiled)
├── gl.js               WebGL2 toolkit: context, shader/program/texture/FBO
│                       helpers, fullscreen triangle, instanced quad batcher.
├── shaders.js          GLSL ES 3.00 sources: scene SDF, synthwave background,
│                       bright pass, blur, composite/post.
├── renderer.js         The pipeline: scene pass → bloom ping-pong → composite.
├── game.js             Game logic, input, juice and the requestAnimationFrame loop.
└── game.css            Overlay UI (title, prompts, score, glitch effect).
```

### Rendering pipeline (per frame)

1. **Scene pass** → an HDR float framebuffer.
   - Procedural synthwave background (grid, sun, stars).
   - A dark "backing" pass so each entity carves a readable outline out of the
     bright background, then an **additive neon pass** for emission.
2. **Bright pass** — extract pixels above the bloom threshold.
3. **Blur** — separable Gaussian, horizontal/vertical ping-pong for N iterations.
4. **Composite** — scene + bloom, exposure & filmic tone mapping, then CRT
   curvature, chromatic aberration, scanlines, vignette, grain and bounce-flash,
   straight to the screen.

## Develop

```bash
npm install        # install dev dependencies
npm run watch      # incremental TypeScript build (the F5 default build task)
npm run compile    # one-shot build
```

The compiled output lives in `out/` and is intentionally **not** committed — it
is regenerated by the build and by `vscode:prepublish` before packaging.

## License

[MIT](LICENSE) © Jan Kepinski
