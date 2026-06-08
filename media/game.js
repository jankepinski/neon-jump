const vscode = acquireVsCodeApi();
const initialState = window.__INITIAL_STATE__ || { highScore: 0 };

const CONFIG = {
  width: 480,
  height: 720,
  targetFrameMs: 1000 / 60,
  maxFrameDeltaMs: 50,
  gravity: 0.38,
  jumpVelocity: -11.7,
  moveSpeed: 6.5,
  playerWidth: 34,
  playerHeight: 42,
  platformHeight: 14,
  // Every platform is the same width: 2.5x the player width.
  platformWidth: 34 * 2.5,
  rowGapJumpRatio: 0.45,
  emptyRowChance: 0.4,
  pairChance: 0.05,
  pairMinGap: 36,
  fragileHits: 3,
  movingPlatformSpeed: 1.5,
  movingPlatformRangeMin: 70,
  movingPlatformRangeMax: 150
};

const PARTICLE_COLORS = {
  normal: [0.2, 0.95, 1.0],
  moving: [0.25, 1.0, 0.55],
  fragile: [1.0, 0.4, 0.5],
  fragileBreak: [1.0, 0.28, 0.35]
};

const MAX_PARTICLES = 420;
const TRAIL_LENGTH = 16;

const state = {
  mode: 'ready',
  score: 0,
  highScore: Number(initialState.highScore) || 0,
  cameraY: 0,
  highestY: 0,
  lastGeneratedRowY: 0,
  lastRowWasEmpty: false,
  keys: {
    left: false,
    right: false
  },
  player: {
    x: CONFIG.width / 2 - CONFIG.playerWidth / 2,
    y: CONFIG.height - 140,
    previousY: CONFIG.height - 140,
    vx: 0,
    vy: 0,
    width: CONFIG.playerWidth,
    height: CONFIG.playerHeight
  },
  platforms: []
};

const fx = {
  trail: [],
  particles: [],
  flash: 0,
  shakeMag: 0,
  shakeX: 0,
  shakeY: 0
};

let renderCameraY = 0;
let squashImpulse = 0;
let rendererReady = false;

const canvas = document.getElementById('game');
const finalScoreEl = document.getElementById('final-score');
const finalBestEl = document.getElementById('final-best');
const resultEl = document.getElementById('result');
const messageEl = document.getElementById('message');
const overlayEl = document.getElementById('overlay');
let lastFrameTime = performance.now();

canvas.focus();
canvas.addEventListener('click', () => canvas.focus());

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function getMaxJumpHeight() {
  return (CONFIG.jumpVelocity * CONFIG.jumpVelocity) / (2 * CONFIG.gravity);
}

function getPlatformRowGap() {
  return getMaxJumpHeight() * CONFIG.rowGapJumpRatio;
}

function getPlatformType(forceNormal = false) {
  if (forceNormal) {
    return 'normal';
  }

  const roll = Math.random();
  if (roll < 0.5) {
    return 'normal';
  }
  if (roll < 0.75) {
    return 'fragile';
  }
  return 'moving';
}

function createMovingPlatformState(x, width) {
  const maxTravel = randomBetween(CONFIG.movingPlatformRangeMin, CONFIG.movingPlatformRangeMax);
  const minX = Math.max(16, x - maxTravel / 2);
  const maxX = Math.min(CONFIG.width - width - 16, x + maxTravel / 2);
  const direction = Math.random() < 0.5 ? -1 : 1;

  return {
    vx: CONFIG.movingPlatformSpeed * direction,
    minX,
    maxX
  };
}

function createPlatformAtRow(y, options = {}) {
  const width = options.width ?? CONFIG.platformWidth;
  const type = options.type ?? getPlatformType(options.forceNormal);
  const x = options.x ?? randomBetween(16, CONFIG.width - width - 16);

  const platform = {
    x,
    y,
    width,
    height: CONFIG.platformHeight,
    type,
    hitsLeft: type === 'fragile' ? CONFIG.fragileHits : null
  };

  if (type === 'moving') {
    const movingState = createMovingPlatformState(x, width);
    platform.vx = movingState.vx;
    platform.minX = movingState.minX;
    platform.maxX = movingState.maxX;
  }

  return platform;
}

function platformsOverlap(first, second) {
  return !(
    first.x + first.width + CONFIG.pairMinGap <= second.x ||
    second.x + second.width + CONFIG.pairMinGap <= first.x
  );
}

function createPlatformPairAtRow(y, firstPlatform) {
  const width = CONFIG.platformWidth;
  const firstCenter = firstPlatform.x + firstPlatform.width / 2;
  const preferRight = firstCenter < CONFIG.width / 2;

  let x = preferRight
    ? randomBetween(CONFIG.width / 2 + 20, CONFIG.width - width - 16)
    : randomBetween(16, CONFIG.width / 2 - width - 20);

  let attempts = 0;
  while (platformsOverlap({ x, width }, firstPlatform) && attempts < 12) {
    x = preferRight
      ? randomBetween(CONFIG.width / 2 + 20, CONFIG.width - width - 16)
      : randomBetween(16, CONFIG.width / 2 - width - 20);
    attempts += 1;
  }

  return createPlatformAtRow(y, { x, width });
}

function shouldRowBeEmpty() {
  if (state.lastRowWasEmpty) {
    return false;
  }

  return Math.random() < CONFIG.emptyRowChance;
}

function spawnPlatformsAtRow(y) {
  const platform = createPlatformAtRow(y);
  state.platforms.push(platform);

  if (Math.random() < CONFIG.pairChance) {
    const pairedPlatform = createPlatformPairAtRow(y, platform);
    if (!platformsOverlap(platform, pairedPlatform)) {
      state.platforms.push(pairedPlatform);
    }
  }
}

function generatePlatformsUntil(targetY) {
  while (state.lastGeneratedRowY > targetY) {
    state.lastGeneratedRowY -= getPlatformRowGap();

    if (shouldRowBeEmpty()) {
      state.lastRowWasEmpty = true;
      continue;
    }

    state.lastRowWasEmpty = false;
    spawnPlatformsAtRow(state.lastGeneratedRowY);
  }
}

function updateMovingPlatforms(timeScale) {
  for (const platform of state.platforms) {
    if (platform.type !== 'moving') {
      continue;
    }

    platform.x += platform.vx * timeScale;

    if (platform.x <= platform.minX) {
      platform.x = platform.minX;
      platform.vx = Math.abs(platform.vx);
    } else if (platform.x >= platform.maxX) {
      platform.x = platform.maxX;
      platform.vx = -Math.abs(platform.vx);
    }
  }
}

function colorForType(platform) {
  if (platform.type === 'moving') {
    return PARTICLE_COLORS.moving;
  }
  if (platform.type === 'fragile') {
    return PARTICLE_COLORS.fragile;
  }
  return PARTICLE_COLORS.normal;
}

function spawnParticles(x, y, count, color, options = {}) {
  const speedScale = options.speedScale || 1;
  const upwardBias = options.upwardBias ?? 1.6;

  for (let i = 0; i < count; i += 1) {
    if (fx.particles.length >= MAX_PARTICLES) {
      break;
    }

    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(1.2, 4.4) * speedScale;
    const life = randomBetween(18, 38);

    fx.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - upwardBias,
      life,
      maxLife: life,
      size: randomBetween(3, 7),
      alpha: 1,
      r: color[0],
      g: color[1],
      b: color[2]
    });
  }
}

function addShake(magnitude) {
  fx.shakeMag = Math.max(fx.shakeMag, magnitude);
}

function onBounce(platform) {
  fx.flash = Math.min(1, fx.flash + 0.8);
  addShake(4.5);
  squashImpulse = 1;

  const centerX = state.player.x + state.player.width / 2;
  spawnParticles(centerX, platform.y, 10, colorForType(platform), { speedScale: 0.9 });
}

function handlePlatformBounce(platform) {
  if (platform.type !== 'fragile') {
    return;
  }

  platform.hitsLeft -= 1;

  if (platform.hitsLeft <= 0) {
    const centerX = platform.x + platform.width / 2;
    const centerY = platform.y + platform.height / 2;
    spawnParticles(centerX, centerY, 24, PARTICLE_COLORS.fragileBreak, {
      speedScale: 1.5,
      upwardBias: 0
    });
    addShake(7);
    fx.flash = Math.min(1, fx.flash + 0.4);
    state.platforms = state.platforms.filter((candidate) => candidate !== platform);
  }
}

function resetGame() {
  state.score = 0;
  state.cameraY = 0;
  state.highestY = CONFIG.height - 140;
  state.lastGeneratedRowY = CONFIG.height - 80;
  state.lastRowWasEmpty = false;
  state.player.x = CONFIG.width / 2 - CONFIG.playerWidth / 2;
  state.player.y = CONFIG.height - 140;
  state.player.previousY = state.player.y;
  state.player.vx = 0;
  state.player.vy = CONFIG.jumpVelocity;
  state.platforms = [
    {
      x: CONFIG.width / 2 - CONFIG.platformWidth / 2,
      y: CONFIG.height - 80,
      width: CONFIG.platformWidth,
      height: CONFIG.platformHeight,
      type: 'normal',
      hitsLeft: null
    }
  ];

  generatePlatformsUntil(-CONFIG.height * 2);

  fx.trail.length = 0;
  fx.particles.length = 0;
  fx.flash = 0;
  fx.shakeMag = 0;
  squashImpulse = 0;
  renderCameraY = state.cameraY;

  if (overlayEl) {
    overlayEl.dataset.mode = 'playing';
  }
  messageEl.textContent = '';
}

function wrapPlayer() {
  const player = state.player;

  if (player.x + player.width < 0) {
    player.x = CONFIG.width;
  } else if (player.x > CONFIG.width) {
    player.x = -player.width;
  }
}

function collideWithPlatforms() {
  const player = state.player;

  if (player.vy <= 0) {
    return;
  }

  const previousBottom = player.previousY + player.height;
  const currentBottom = player.y + player.height;

  for (const platform of state.platforms) {
    const overlapsX =
      player.x + player.width > platform.x &&
      player.x < platform.x + platform.width;

    const crossesTop =
      previousBottom <= platform.y &&
      currentBottom >= platform.y;

    if (overlapsX && crossesTop) {
      player.y = platform.y - player.height;
      player.vy = CONFIG.jumpVelocity;
      onBounce(platform);
      handlePlatformBounce(platform);
      return;
    }
  }
}

function updateCameraAndScore() {
  const player = state.player;
  const cameraThreshold = state.cameraY + CONFIG.height * 0.4;

  if (player.y < cameraThreshold) {
    state.cameraY = player.y - CONFIG.height * 0.4;
  }

  if (player.y < state.highestY) {
    state.highestY = player.y;
    state.score = Math.max(0, Math.floor((CONFIG.height - 140 - state.highestY) / 10));
  }
}

function maintainPlatforms() {
  const bottomLimit = state.cameraY + CONFIG.height + 120;
  state.platforms = state.platforms.filter((platform) => platform.y < bottomLimit);

  const targetTop = state.cameraY - CONFIG.height;
  generatePlatformsUntil(targetTop);
}

function endGame() {
  state.mode = 'gameOver';
  const isRecord = state.score > state.highScore;
  state.highScore = Math.max(state.highScore, state.score);
  addShake(9);
  fx.flash = Math.min(1, fx.flash + 0.6);
  spawnParticles(
    state.player.x + state.player.width / 2,
    state.player.y + state.player.height / 2,
    30,
    PARTICLE_COLORS.fragileBreak,
    { speedScale: 1.6, upwardBias: 0 }
  );

  if (finalScoreEl) {
    finalScoreEl.textContent = String(state.score).padStart(6, '0');
  }
  if (finalBestEl) {
    finalBestEl.textContent = String(state.highScore).padStart(6, '0');
  }
  if (resultEl) {
    resultEl.classList.toggle('record', isRecord);
  }

  if (overlayEl) {
    overlayEl.dataset.mode = 'gameOver';
  }
  messageEl.textContent = isRecord ? 'New best! Press Space to restart' : 'Press Space to restart';

  vscode.postMessage({
    type: 'gameOver',
    score: state.score
  });
}

function update(timeScale) {
  const player = state.player;
  player.previousY = player.y;

  const direction = Number(state.keys.right) - Number(state.keys.left);
  player.vx = direction * CONFIG.moveSpeed;
  player.vy += CONFIG.gravity * timeScale;
  player.x += player.vx * timeScale;
  player.y += player.vy * timeScale;

  wrapPlayer();

  if (player.y + player.height - state.cameraY >= CONFIG.height) {
    endGame();
    return;
  }

  updateMovingPlatforms(timeScale);
  collideWithPlatforms();
  updateCameraAndScore();
  maintainPlatforms();

  fx.trail.unshift({
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height,
    alpha: 0.5
  });
  if (fx.trail.length > TRAIL_LENGTH) {
    fx.trail.pop();
  }
}

function updateFx(timeScale) {
  fx.flash = Math.max(0, fx.flash - 0.05 * timeScale);
  squashImpulse = Math.max(0, squashImpulse - 0.08 * timeScale);

  fx.shakeMag *= Math.pow(0.85, timeScale);
  if (fx.shakeMag < 0.05) {
    fx.shakeMag = 0;
  }
  fx.shakeX = (Math.random() * 2 - 1) * fx.shakeMag;
  fx.shakeY = (Math.random() * 2 - 1) * fx.shakeMag;

  for (let i = 0; i < fx.trail.length; i += 1) {
    fx.trail[i].alpha *= Math.pow(0.86, timeScale);
  }

  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const p = fx.particles[i];
    p.x += p.vx * timeScale;
    p.y += p.vy * timeScale;
    p.vy += 0.12 * timeScale;
    p.life -= timeScale;

    if (p.life <= 0) {
      fx.particles.splice(i, 1);
      continue;
    }

    p.alpha = clamp(p.life / p.maxLife, 0, 1);
  }
}

function buildVisualPlayer() {
  const p = state.player;
  const stretch = clamp(1 + -p.vy * 0.004, 0.86, 1.18);
  let sy = stretch;
  let sx = 1 / Math.sqrt(stretch);

  sx *= 1 + 0.28 * squashImpulse;
  sy *= 1 - 0.22 * squashImpulse;

  const width = p.width * sx;
  const height = p.height * sy;

  return {
    x: p.x + (p.width - width) / 2,
    y: p.y + (p.height - height),
    width,
    height
  };
}

function buildViewModel(timeSec) {
  return {
    logicalWidth: CONFIG.width,
    logicalHeight: CONFIG.height,
    cameraY: renderCameraY,
    time: timeSec,
    flash: fx.flash,
    shakeX: fx.shakeX,
    shakeY: fx.shakeY,
    fragileHits: CONFIG.fragileHits,
    score: String(state.score).padStart(Math.max(3, String(state.score).length), '0'),
    scoreActive: state.mode === 'playing',
    record: state.score > state.highScore,
    platforms: state.platforms,
    player: buildVisualPlayer(),
    trail: fx.trail,
    particles: fx.particles
  };
}

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
      resetGame();
      state.mode = 'playing';
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

window.addEventListener('resize', () => {
  if (rendererReady) {
    window.NeonRenderer.resize();
  }
});

function loop(timestamp) {
  const frameDelta = Math.min(timestamp - lastFrameTime, CONFIG.maxFrameDeltaMs);
  lastFrameTime = timestamp;
  const timeScale = frameDelta / CONFIG.targetFrameMs;

  if (state.mode === 'playing') {
    update(timeScale);
  }

  updateFx(timeScale);
  renderCameraY += (state.cameraY - renderCameraY) * Math.min(1, 0.5 * timeScale);

  if (rendererReady) {
    window.NeonRenderer.renderFrame(buildViewModel(timestamp / 1000));
  }

  requestAnimationFrame(loop);
}

function showFallback() {
  if (overlayEl) {
    overlayEl.dataset.mode = 'error';
  }
  messageEl.textContent = 'WebGL2 is required to play this game.';
}

function boot() {
  rendererReady = window.NeonRenderer.init(canvas);

  if (!rendererReady) {
    showFallback();
    return;
  }

  if (overlayEl) {
    overlayEl.dataset.mode = 'ready';
  }
  requestAnimationFrame(loop);
}

boot();
