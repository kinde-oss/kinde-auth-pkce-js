import {createRequire} from 'node:module';
import {defineConfig} from 'rollup';
import del from 'rollup-plugin-delete';
import dts from 'rollup-plugin-dts';

const require = createRequire(import.meta.url);
const tscf = require('./tsconfig.json');
const {declarationDir, outDir} = tscf.compilerOptions;

export default defineConfig([
  // Main index types
  {
    input: `${declarationDir}/index.d.ts`,
    output: {
      name: 'typesDeclarationFile',
      file: `${outDir}/index.d.ts`,
      format: 'es'
    },
    plugins: [dts()]
  },
  // Utils types
  {
    input: `${declarationDir}/kindeUtils.d.ts`,
    output: {
      name: 'utilsTypesDeclarationFile',
      file: `${outDir}/utils.d.ts`,
      format: 'es'
    },
    plugins: [
      dts(),
      del({
        targets: [declarationDir],
        hook: 'buildEnd'
      })
    ]
  }
]);
