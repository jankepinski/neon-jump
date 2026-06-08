# Changelog

All notable changes to **Neon Jump** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-08

### Added

- Initial release of Neon Jump.
- Hand-written WebGL2 renderer: SDF neon entities, HDR bloom (bright pass +
  separable blur ping-pong), and an instanced rounded-rect batcher.
- Procedural synthwave background: perspective grid, scanline sun, twinkling
  stars and drifting light cells.
- Live score baked into the sun shader; persistent local high score.
- CRT post-processing: barrel curvature, chromatic aberration, scanlines,
  vignette and film grain.
- Game feel: squash & stretch, motion trail, particle bursts, screen shake and
  hit-flash.
- Three platform types — stable, fragile (3 hits) and moving.

[0.1.0]: https://github.com/jankepinski/neon-jump/releases/tag/v0.1.0
