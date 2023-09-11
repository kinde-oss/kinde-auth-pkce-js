import {createRequire} from 'node:module';
import {defineConfig} from 'rollup';
import del from 'rollup-plugin-delete';
import dts from 'rollup-plugin-dts';

const require = createRequire(import.meta.url);
const tscf = require('./tsconfig.json');
const { declarationDir, outDir } = tscf.compilerOptions

export default defineConfig({
  input: `${declarationDir}/index.d.ts`,
  output: {
    name: 'typesDeclarationFile',
    file: `${outDir}/index.d.ts`,
    format: 'es'
  },
  plugins: [
    del({ 
      targets: [declarationDir], 
      hook: 'buildEnd',
    }),
    dts(),
  ],
});
