import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

export default [
  {
    input: 'src/main.js',

    plugins: [terser()],
    output: [
      {
        name: 'createKindeClient',
        file: 'dist/kinde-auth-pkce-js.umd.min.js',
        format: 'umd'
      },
      {
        file: 'dist/kinde-auth-pkce-js.esm.min.js',
        format: 'es'
      }
    ]
  },
  {
    // path to your declaration files root
    input: 'index.d.ts',
    output: [{file: 'dist/index.d.ts', format: 'es'}],
    plugins: [dts()]
  }
];
