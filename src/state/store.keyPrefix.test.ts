import {storageSettings} from '@kinde/js-utils';
import {store} from './store';

describe('Store with keyPrefix', () => {
  const originalPrefix = storageSettings.keyPrefix;

  beforeEach(() => {
    // Reset the store before each test
    store.reset();
  });

  afterEach(() => {
    // Restore original prefix
    storageSettings.keyPrefix = originalPrefix;
    store.reset();
  });

  test('should use custom keyPrefix when storing items', () => {
    // Set custom prefix
    storageSettings.keyPrefix = 'YourPrefixHere-';

    // Store a value
    store.setItem('test_key', 'test_value');

    // Retrieve the value using the same key
    const value = store.getItem('test_key');
    expect(value).toBe('test_value');
  });

  test('should store with prefix and retrieve correctly', () => {
    storageSettings.keyPrefix = 'MyApp-';

    // Store multiple values
    store.setItem('user_id', '12345');
    store.setItem('session_token', 'abc123xyz');

    // Verify retrieval works
    expect(store.getItem('user_id')).toBe('12345');
    expect(store.getItem('session_token')).toBe('abc123xyz');
  });

  test('should handle prefix changes correctly', () => {
    // Store with first prefix
    storageSettings.keyPrefix = 'Prefix1-';
    store.setItem('key1', 'value1');
    expect(store.getItem('key1')).toBe('value1');

    // Change prefix - old data should not be accessible with same key
    storageSettings.keyPrefix = 'Prefix2-';
    expect(store.getItem('key1')).toBeNull();

    // Store with new prefix
    store.setItem('key1', 'value2');
    expect(store.getItem('key1')).toBe('value2');

    storageSettings.keyPrefix = 'Prefix1-';
    expect(store.getItem('key1')).toBe('value1');
  });

  test('should work with complex objects and prefix', () => {
    storageSettings.keyPrefix = 'TestPrefix-';

    const testObject = {
      id: '123',
      name: 'Test User',
      nested: {
        property: 'value'
      }
    };

    store.setItem('user_object', testObject);
    const retrieved = store.getItem('user_object');

    expect(retrieved).toEqual(testObject);
  });

  test('should use SessionManager methods with prefix', async () => {
    storageSettings.keyPrefix = 'Session-';

    // Test setSessionItem
    store.setSessionItem('session_id', 'xyz789');
    expect(store.getSessionItem('session_id')).toBe('xyz789');

    // Test setItems
    await store.setItems({
      item1: 'value1',
      item2: 'value2'
    });

    const items = await store.getItems('item1', 'item2');
    expect(items).toEqual({
      item1: 'value1',
      item2: 'value2'
    });
  });
});
