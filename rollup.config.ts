/// <reference types="node" />
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {resolve as pathResolve} from 'node:path';
import {defineConfig} from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');
const distDir = pathResolve(process.cwd(), 'dist');

/**
 * After the main bundle is written, emit utils re-export files so that
 * "@kinde-oss/kinde-auth-pkce-js/utils" uses the same js-utils instance as the
 * main bundle (no duplicate copy).
 */
function writeUtilsReexports() {
  let done = false;
  return {
    name: 'write-utils-reexports',
    writeBundle() {
      if (done) return;
      done = true;
      writeFileSync(
        pathResolve(distDir, 'utils.esm.js'),
        "export * from './kinde-auth-pkce-js.esm.js';\n"
      );
      writeFileSync(
        pathResolve(distDir, 'utils.cjs'),
        [
          "'use strict';",
          "var m = require('./kinde-auth-pkce-js.umd.min.js');",
          "Object.keys(m).forEach(function(k){ if(k!=='default') exports[k]=m[k]; });",
          ''
        ].join('\n')
      );
    }
  };
}

export default defineConfig([
  // Main package bundle (includes js-utils via kindeUtils so there is only one copy)
  {
    input: 'src/index.ts',
    output: [
      {
        name: 'createKindeClient',
        file: pkg.main,
        format: 'umd',
        exports: 'named',
        inlineDynamicImports: true,
        plugins: [terser()]
      },
      {
        file: pkg.module,
        format: 'es',
        exports: 'named',
        inlineDynamicImports: true
      }
    ],
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declarationDir: 'dist/types',
        rootDir: 'src'
      }),
      writeUtilsReexports()
    ]
  }
]);
