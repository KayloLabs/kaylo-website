import test from 'node:test';
import assert from 'node:assert/strict';
import {sitePath} from './site-path.ts';

test('plain page links, anchors and assets use the project base path', () => {
  assert.equal(sitePath('/', '/kaylo-website'), '/kaylo-website/');
  assert.equal(sitePath('/services/', '/kaylo-website'), '/kaylo-website/services/');
  assert.equal(sitePath('/#about', '/kaylo-website'), '/kaylo-website/#about');
  assert.equal(sitePath('/app-art/mode_care.png', '/kaylo-website'), '/kaylo-website/app-art/mode_care.png');
});

test('root deployments and existing project prefixes remain unchanged', () => {
  assert.equal(sitePath('/services/', ''), '/services/');
  assert.equal(sitePath('/favicon.svg', '/'), '/favicon.svg');
  assert.equal(sitePath('/kaylo-website/services/', '/kaylo-website/'), '/kaylo-website/services/');
  assert.equal(sitePath('/kaylo-website#about', '/kaylo-website'), '/kaylo-website#about');
  assert.equal(sitePath('/kaylo-website-other/', '/kaylo-website'), '/kaylo-website/kaylo-website-other/');
});

test('external URLs, local fragments and relative links are untouched', () => {
  for (const path of ['https://example.com/document?token=test', 'mailto:kayloapp@gmail.com', '//cdn.example.com/image.png', '#logo-clip', './image.png']) {
    assert.equal(sitePath(path, '/kaylo-website'), path);
  }
});

test('invalid base path configuration fails rather than generating broken links', () => {
  for (const base of ['https://example.com', '//host', '/site?x=1', '/site#fragment', '/site/../other']) {
    assert.throws(() => sitePath('/services/', base), /NEXT_PUBLIC_BASE_PATH/);
  }
});
