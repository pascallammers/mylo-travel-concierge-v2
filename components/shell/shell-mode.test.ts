import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShellModeProvider, useInShell } from './shell-mode';

function Mode() {
  return createElement('span', null, String(useInShell()));
}

test('legacy chat pages default to false without a provider', () => {
  assert.equal(renderToStaticMarkup(createElement(Mode)), '<span>false</span>');
});

test('shell children read true and siblings stay in legacy mode', () => {
  const tree = createElement('div', null,
    createElement(ShellModeProvider, null, createElement(Mode)), createElement(Mode),
  );
  assert.equal(renderToStaticMarkup(tree), '<div><span>true</span><span>false</span></div>');
});
