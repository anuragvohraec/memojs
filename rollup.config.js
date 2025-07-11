import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/inmemocache.ts', // Your main entry point
  output: {
    file: 'dist/memo.js', // Final output file
    format: 'esm', // ESM format
    sourcemap: true,
  },
  plugins: [
    resolve(),        // Resolves node_modules
    commonjs(),       // Converts CommonJS to ESM
    typescript(),     // Compiles TypeScript
  ]
};
