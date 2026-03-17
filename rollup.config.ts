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

const EXPO_STUB_ID = '\0expo-secure-store-stub';

/**
 * Stub expo-secure-store so the bundle never contains an unresolved dynamic
 * import. js-utils optionally uses it for React Native; in browser/Node/SPA
 * we provide a no-op stub so consumer bundlers (e.g. Vite) don't try to
 * resolve the missing package.
 */
function stubExpoSecureStore() {
  const stubCode = [
    'export default {',
    '  setItemAsync: async () => {},',
    '  getItemAsync: async () => null,',
    '  deleteItemAsync: async () => {}',
    '};'
  ].join('\n');
  const stubExpr =
    'Promise.resolve({ default: { setItemAsync: async () => {}, getItemAsync: async () => null, deleteItemAsync: async () => {} } })';
  return {
    name: 'stub-expo-secure-store',
    order: 'pre',
    resolveId(id) {
      if (
        id === 'expo-secure-store' ||
        (typeof id === 'string' && id.includes('expo-secure-store'))
      ) {
        return {id: EXPO_STUB_ID, moduleSideEffects: false};
      }
      return null;
    },
    load(id) {
      if (id !== EXPO_STUB_ID) return null;
      return stubCode;
    },
    transform(code, id) {
      if (!id.includes('expoSecureStore') && !id.includes('expo-secure-store'))
        return null;
      const newCode = code.replace(
        /await\s+import\s*\(\s*[\s\S]*?["']expo-secure-store["']\s*\)/g,
        'await ' + stubExpr
      );
      return newCode !== code ? {code: newCode, map: null} : null;
    }
  };
}

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
        inlineDynamicImports: true,
        plugins: [terser()]
      },
      {
        file: pkg.module,
        format: 'es',
        inlineDynamicImports: true
      }
    ],
    external: ['expo-secure-store'],
    plugins: [
      stubExpoSecureStore(),
      resolve(),
      typescript({
        declarationDir: 'dist/types',
        rootDir: 'src'
      }),
      writeUtilsReexports()
    ]
  }
]);
