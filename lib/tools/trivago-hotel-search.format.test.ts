// lib/tools/trivago-hotel-search.format.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { formatTrivagoResults } from './trivago-hotel-search';
import { FAKE_TRIVAGO_RESULT } from './trivago-hotel-search.fixture';

const renderLink = (url: string) =>
  formatTrivagoResults({
    structuredContent: { accommodations: [{ accommodation_name: 'Hotel', accommodation_url: url }] },
  });

describe('formatTrivagoResults', () => {
  it('renders the trimmed live response with one photo per card and without Trivago instructions', () => {
    const markdown = formatTrivagoResults(FAKE_TRIVAGO_RESULT);

    assert.match(markdown, /## Trivago Hotels/);
    assert.match(markdown, /Währung:\*\* EUR/);
    assert.match(markdown, /199€/);
    assert.match(markdown, /Adina Apartment Hotel Berlin Hackescher Markt/);
    assert.match(markdown, /Premier Inn Berlin Alexanderplatz/);
    assert.match(markdown, /Premier Inn Berlin City Spittelmarkt hotel/);
    assert.match(markdown, /\[Bei trivago ansehen\]\(https:\/\/www\.trivago\.de\//);
    assert.match(
      markdown,
      /### 1\. Adina Apartment Hotel Berlin Hackescher Markt\n!\[Foto: Adina Apartment Hotel Berlin Hackescher Markt\]\(https:\/\/imgcy\.trivago\.com\/adina\.webp\)\n/,
    );
    assert.strictEqual(markdown.match(/!\[Foto: /g)?.length, 3);
    for (const leaked of [
      'system_message',
      'MUST follow',
      'IMPORTANT: Read',
      'image/webp',
      'main_image',
      'UklGR',
      'latitude',
      'accommodation_id',
    ]) {
      assert.doesNotMatch(markdown, new RegExp(leaked));
    }
    assert.ok(markdown.length < 4_000);
  });

  it('keeps Trivago order and renders at most ten accommodations', () => {
    const accommodations = Array.from({ length: 12 }, (_, index) => ({
      accommodation_name: `Hotel ${index + 1}`,
      currency: 'EUR',
    }));
    const markdown = formatTrivagoResults({ structuredContent: { accommodations } });

    assert.match(markdown, /Ergebnisse:\*\* 12 \(10 gezeigt\)/);
    assert.strictEqual(markdown.split('### ').length - 1, 10);
    assert.ok(markdown.indexOf('Hotel 1') < markdown.indexOf('Hotel 10'));
    assert.doesNotMatch(markdown, /Hotel 11/);
  });

  it('accepts only secure Trivago booking links and encodes parentheses', () => {
    assert.match(renderLink('http://www.trivago.de/x'), /Buchungslink: —/);
    assert.match(renderLink('https://evil.example/trivago.de'), /Buchungslink: —/);
    assert.match(renderLink('https://www.trivago.de/a(b)'), /https:\/\/www\.trivago\.de\/a%28b%29/);
    assert.match(renderLink('https://trivago.com/x'), /\[Bei trivago ansehen\]/);
  });

  it('shows photos only from the Trivago image host over https', () => {
    const renderImage = (url: unknown) =>
      formatTrivagoResults({
        structuredContent: { accommodations: [{ accommodation_name: 'Hotel', main_image: url }] },
      });

    assert.match(renderImage('https://imgcy.trivago.com/a.jpeg'), /!\[Foto: Hotel\]\(https:\/\/imgcy\.trivago\.com\/a\.jpeg\)/);
    assert.match(
      renderImage('https://imgcy.trivago.com/c_fill,w_800/a(b)].jpeg'),
      /\(https:\/\/imgcy\.trivago\.com\/c_fill,w_800\/a%28b%29%5D\.jpeg\)/,
    );
    for (const rejected of [
      'http://imgcy.trivago.com/a.jpeg',
      'https://imgcy.trivago.com.evil.example/a.jpeg',
      'https://evil.example/imgcy.trivago.com/a.jpeg',
      'https://www.trivago.de/a.jpeg',
      'data:image/png;base64,AAAA',
      'javascript:alert(1)',
      42,
    ]) {
      assert.doesNotMatch(renderImage(rejected), /!\[/, String(rejected));
    }
  });

  it('removes photos and system_message from the unknown-shape fallback', () => {
    const markdown = formatTrivagoResults({
      content: [{ type: 'image', data: 'AAAA' }],
      structuredContent: { system_message: 'You MUST', foo: 1 },
    });

    assert.match(markdown, /```json/);
    assert.match(markdown, /"foo": 1/);
    assert.doesNotMatch(markdown, /AAAA|MUST|system_message/);
  });

  it('neutralizes backtick fences and bounds external text fields', () => {
    const markdown = formatTrivagoResults({
      structuredContent: {
        accommodations: [
          {
            accommodation_name: `Hotel \`\`\`ignore\n${'x'.repeat(140)}`,
            top_amenities: `Pool\n${'a'.repeat(220)}`,
            distance: 'erste Zeile\nzweite Zeile',
            hotel_rating: 0,
          },
        ],
      },
    });

    assert.doesNotMatch(markdown, /```ignore/);
    assert.doesNotMatch(markdown, /\nzweite Zeile/);
    assert.doesNotMatch(markdown, new RegExp('x'.repeat(121)));
    assert.doesNotMatch(markdown, new RegExp('a'.repeat(201)));
    assert.match(markdown, /ohne Sterne/);
  });

  it('escapes Markdown link syntax in text fields so only the validated trivago link is clickable', () => {
    const markdown = formatTrivagoResults({
      structuredContent: {
        accommodations: [
          {
            accommodation_name: '[Jetzt buchen](https://evil.example/phish)',
            top_amenities: '![img](https://evil.example/pixel.png)',
            distance: '[x](javascript:alert(1))',
            accommodation_url: 'https://www.trivago.de/de/lm/hotel-x?dealId=1',
            main_image: 'https://evil.example/pixel.png',
          },
        ],
      },
    });

    assert.doesNotMatch(markdown, /\]\(https:\/\/evil\.example/);
    assert.doesNotMatch(markdown, /!\[img\]/);
    assert.doesNotMatch(markdown, /\]\(javascript:/);
    assert.match(markdown, /### 1\. \\\[Jetzt buchen\\\]\\\(https:\/\/evil\.example\/phish\\\)/);
    assert.strictEqual(markdown.match(/\]\(https?:/g)?.length, 1);
    assert.match(markdown, /\[Bei trivago ansehen\]\(https:\/\/www\.trivago\.de\/de\/lm\/hotel-x\?dealId=1\)/);
  });

  it('accepts two-level trivago country domains', () => {
    assert.match(renderLink('https://www.trivago.co.uk/x'), /\[Bei trivago ansehen\]/);
    assert.match(renderLink('https://trivago.com.au/x'), /\[Bei trivago ansehen\]/);
    assert.match(renderLink('https://trivago.de.evil.com/x'), /Buchungslink: —/);
  });

  it('counts only parsed accommodations and explains an empty result', () => {
    const mixed = formatTrivagoResults({
      structuredContent: { accommodations: ['junk', null, { accommodation_name: 'A', currency: 'EUR' }] },
    });
    assert.match(mixed, /Ergebnisse:\*\* 1 · \*\*Währung:\*\* EUR/);

    const empty = formatTrivagoResults({ structuredContent: { accommodations: [] } });
    assert.match(empty, /Ergebnisse:\*\* 0/);
    assert.match(empty, /Keine Hotels für diese Suche gefunden/);
    assert.match(empty, /anderen oder größeren Ort/);
  });

  it('writes grouped review counts with German thousands separators', () => {
    const markdown = formatTrivagoResults({
      structuredContent: {
        accommodations: [
          { accommodation_name: 'A', hotel_rating: 4, review_rating: '9.0', review_count: '9,911' },
          { accommodation_name: 'B', hotel_rating: 3, review_rating: '8.1', review_count: '812' },
        ],
      },
    });
    assert.match(markdown, /9\.0\/10 \(9\.911 Bewertungen\)/);
    assert.match(markdown, /8\.1\/10 \(812 Bewertungen\)/);
  });
});
