import assert from 'node:assert';
import { describe, it } from 'node:test';
import { readAllowedChatImageSource } from './chat-image-source';

describe('readAllowedChatImageSource', () => {
  it('returns the normalized https URL for the Trivago image host', () => {
    assert.strictEqual(
      readAllowedChatImageSource('https://imgcy.trivago.com/c_fill,w_800/a b.jpeg'),
      'https://imgcy.trivago.com/c_fill,w_800/a%20b.jpeg',
    );
    assert.strictEqual(readAllowedChatImageSource('https://IMGCY.trivago.com/a.jpeg'), 'https://imgcy.trivago.com/a.jpeg');
  });

  it('rejects every other host, scheme, and malformed value', () => {
    for (const rejected of [
      'http://imgcy.trivago.com/a.jpeg',
      'https://imgcy.trivago.com.evil.example/a.jpeg',
      'https://evil.example/imgcy.trivago.com/a.jpeg',
      'https://user@evil.example/a.jpeg',
      'https://www.trivago.de/a.jpeg',
      'data:image/png;base64,AAAA',
      'javascript:alert(1)',
      '/relative.png',
      '',
      'not a url',
    ]) {
      assert.strictEqual(readAllowedChatImageSource(rejected), undefined, rejected);
    }
  });
});
