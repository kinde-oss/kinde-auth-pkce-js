import {store} from './src/state/store.ts';

console.log('Store object:', Object.keys(store));
console.log('\nSetting test_key = test_value');
store.setItem('test_key', 'test_value');

console.log('\nGetting test_key');
const value = store.getItem('test_key');
console.log('Retrieved value:', value);

console.log('\nGetting via getSessionItem');
const sessionValue = store.getSessionItem('test_key');
console.log('Session value:', sessionValue);
