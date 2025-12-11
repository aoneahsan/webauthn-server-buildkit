import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';

// Read version from package.json at build time
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  shims: true,
  treeshake: true,
  external: [],
  noExternal: ['cbor-x'],
  define: {
    __VERSION__: JSON.stringify(packageJson.version),
  },
  esbuildOptions(options) {
    options.platform = 'node';
  },
});
