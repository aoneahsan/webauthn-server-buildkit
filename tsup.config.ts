import { defineConfig } from 'tsup';

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
  esbuildOptions(options) {
    options.platform = 'node';
  },
});
