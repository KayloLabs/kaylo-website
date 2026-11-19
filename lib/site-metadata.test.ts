import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  canonicalMetadata, canonicalSiteOrigin, publicPagePaths, publicPages, officialProfiles,
  homeStructuredData, breadcrumbStructuredData, serializeStructuredData,
} from './site-metadata.ts';

test('every public page has matching canonical, search and social metadata', () => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const path of publicPagePaths) {
    const metadata = canonicalMetadata(path);
    const canonical = new URL(path, canonicalSiteOrigin).toString();
    assert.equal(metadata.alternates.canonical, canonical);
    assert.equal(metadata.openGraph.url, canonical);
    assert.equal(metadata.openGraph.title, metadata.title);
    assert.equal(metadata.twitter.title, metadata.title);
    assert.equal(metadata.openGraph.description, metadata.description);
    assert.equal(metadata.twitter.description, metadata.description);
    assert.equal(metadata.openGraph.siteName, 'Kaylo');
    assert.equal(metadata.twitter.card, 'summary_large_image');
    assert.equal(metadata.robots.index, true);
    assert.equal(metadata.robots.follow, true);
    assert.ok(metadata.title.length > 12 && metadata.title.length < 75);
    assert.ok(metadata.description.length > 70 && metadata.description.length < 180);
    assert.match(metadata.openGraph.images[0].url, /^https:\/\/kaylo\.in\/images\//);
    assert.equal(metadata.openGraph.images[0].width, 1200);
    assert.equal(metadata.openGraph.images[0].height, 630);
    titles.add(metadata.title);
    descriptions.add(metadata.description);
  }
  assert.equal(titles.size, publicPagePaths.length);
  assert.equal(descriptions.size, publicPagePaths.length);
  assert.deepEqual(Object.keys(publicPages).sort(), [...publicPagePaths].sort());
});

test('homepage identity is consistent without unsupported company or review claims', () => {
  const nodes = homeStructuredData['@graph'];
  const organization = nodes.find(node => node['@type'] === 'Organization');
  const website = nodes.find(node => node['@type'] === 'WebSite');
  assert.ok(organization && website);
  assert.equal(organization.name, 'Kaylo');
  assert.equal(organization.email, 'kayloapp@gmail.com');
  assert.equal(organization.url, `${canonicalSiteOrigin}/`);
  assert.equal(organization.logo?.url, `${canonicalSiteOrigin}/icons/kaylo-mark-v2-512.png`);
  assert.equal(website.url, organization.url);
  assert.deepEqual(organization.sameAs, [
    'https://www.linkedin.com/company/kayloapp/',
    'https://www.instagram.com/kaylo_app/',
  ]);
  assert.deepEqual(website.publisher, { '@id': organization['@id'] });
  const encoded = JSON.stringify(homeStructuredData);
  for (const unsupported of ['aggregateRating', 'reviewCount', 'legalName', 'taxID', 'address', 'SearchAction']) {
    assert.equal(encoded.includes(`"${unsupported}"`), false);
  }
});

test('breadcrumb data matches the visible services and download hierarchy', () => {
  for (const path of ['/services/', '/download/'] as const) {
    const breadcrumb = breadcrumbStructuredData(path);
    assert.equal(breadcrumb['@type'], 'BreadcrumbList');
    assert.deepEqual(breadcrumb.itemListElement.map(item => item.position), [1, 2]);
    assert.equal(breadcrumb.itemListElement[0].name, 'Kaylo');
    assert.equal(breadcrumb.itemListElement[1].name, path === '/services/' ? 'Services' : 'Download');
    assert.equal(breadcrumb.itemListElement[1].item, `${canonicalSiteOrigin}${path}`);
  }
});

test('JSON-LD serialization cannot terminate its script element', () => {
  const input = { name: '</script><script>alert("x")</script> & Kaylo' };
  const encoded = serializeStructuredData(input);
  assert.equal(encoded.includes('<'), false);
  assert.equal(encoded.includes('>'), false);
  assert.equal(encoded.includes('&'), false);
  assert.deepEqual(JSON.parse(encoded), input);
});

test('private pages retain noindex and do not inherit homepage canonicals or social data', async () => {
  const layout = await readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.equal(/alternates\s*:|openGraph\s*:|twitter\s*:|homeStructuredData/.test(layout), false);
  for (const route of ['admin', 'application/update']) {
    const source = await readFile(new URL(`../app/${route}/page.tsx`, import.meta.url), 'utf8');
    assert.match(source, /robots:\s*\{index:false,follow:false\}/);
    assert.match(source, /referrer:'no-referrer'/);
    assert.equal(source.includes('canonicalMetadata'), false);
  }
});

test('official profiles are canonical HTTPS profile pages linked from the footer', async () => {
  const footer = await readFile(new URL('../components/Footer.tsx', import.meta.url), 'utf8');
  for (const profile of officialProfiles) {
    const url = new URL(profile.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    if (profile.name === 'LinkedIn') {
      assert.match(profile.url, /^https:\/\/www\.linkedin\.com\/company\/[a-z0-9-]+\/$/);
    } else {
      assert.equal(profile.name, 'Instagram');
      assert.match(profile.url, /^https:\/\/www\.instagram\.com\/[a-z0-9_.]+\/$/);
    }
  }
  assert.match(footer, /officialProfiles\.map/);
});
