import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json');
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

export default [
  {
    input: 'src/main.js',
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
    ]
  },
  {
    input: 'index.d.ts',
    output: [{file: 'dist/index.d.ts', format: 'es'}],
    plugins: [dts()]
  }
];
