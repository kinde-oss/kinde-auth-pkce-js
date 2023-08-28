import {createRequire} from 'node:module';
import {defineConfig} from 'rollup';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

export default defineConfig({
  input: 'src/main.ts',
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
  plugins: [typescript()]
});
