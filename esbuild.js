const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

const host = {
  ...shared,
  entryPoints: ['src/extension.ts'],
  outfile: 'out/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'],
};

const webview = {
  ...shared,
  entryPoints: ['src/webview/main.ts'],
  outfile: 'out/webview/webview.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  loader: { '.glsl': 'text' },
};

async function main() {
  const builds = [host, webview];
  if (watch) {
    const ctxs = await Promise.all(builds.map((b) => esbuild.context(b)));
    await Promise.all(ctxs.map((c) => c.watch()));
    console.log('[watch] watching host + webview');
  } else {
    await Promise.all(builds.map((b) => esbuild.build(b)));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
