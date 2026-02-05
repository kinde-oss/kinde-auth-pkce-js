import {createRequire} from 'node:module';
import {defineConfig} from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

export default defineConfig([
  // Main package bundle
  {
    input: 'src/index.ts',
    output: [
      {
        name: 'createKindeClient',
        file: pkg.main,
        format: 'umd',
        plugins: [terser()]
      },
      {
        file: pkg.module,
        format: 'es'
      }
    ],
    plugins: [resolve(), typescript()]
  },
  // Utils re-export bundle
  {
    input: 'src/kindeUtils.ts',
    output: [
      {
        file: 'dist/utils.cjs',
        format: 'cjs',
        exports: 'named'
      },
      {
        file: 'dist/utils.esm.js',
        format: 'es'
      }
    ],
    external: ['@kinde/js-utils'],
    plugins: [
      resolve(),
      typescript({
        declaration: true,
        declarationDir: 'dist',
        rootDir: 'src'
      })
    ]
  }
]);
