import { describe, it, expect, beforeEach } from 'vitest';
import { extractPageMetadata, extractImages } from '../../src/content/dom-scanner';

describe('DOM Scanner', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('extracts head metadata, canonical, robots, and heading hierarchy', () => {
    document.title = 'Test Store - Home';
    document.documentElement.lang = 'en';

    document.head.innerHTML = `
      <title>Test Store - Home</title>
      <meta charset="utf-8">
      <meta name="description" content="A comprehensive online testing store">
      <meta name="robots" content="index, follow">
      <link rel="canonical" href="https://example.com/store">
      <meta property="og:title" content="OG Test Store">
      <meta property="og:description" content="OG Description of Test Store">
      <meta property="og:image" content="https://example.com/og.png">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    `;

    document.body.innerHTML = `
      <h1>Main Headline</h1>
      <h2>Subheading 1</h2>
      <h2>Subheading 2</h2>
      <h3>Detail 1</h3>
      <h4>Minor 1</h4>
    `;

    const metadata = extractPageMetadata(document);

    expect(metadata.title).toBe('Test Store - Home');
    expect(metadata.description).toBe('A comprehensive online testing store');
    expect(metadata.robots).toBe('index, follow');
    expect(metadata.canonical).toBe('https://example.com/store');
    expect(metadata.ogTitle).toBe('OG Test Store');
    expect(metadata.ogImage).toBe('https://example.com/og.png');
    expect(metadata.lang).toBe('en');
    expect(metadata.h1Count).toBe(1);
    expect(metadata.h1Texts).toEqual(['Main Headline']);
    expect(metadata.headingCounts.h1).toBe(1);
    expect(metadata.headingCounts.h2).toBe(2);
    expect(metadata.headingCounts.h3).toBe(1);
    expect(metadata.headingCounts.h4).toBe(1);
    expect(metadata.headingCounts.h5).toBe(0);
  });

  it('extracts images and correctly detects missing alt text and attributes', () => {
    document.body.innerHTML = `
      <img id="hero-img" src="https://example.com/hero.jpg" alt="Hero product banner" width="800" height="400" />
      <img id="logo-img" src="https://example.com/logo.svg" alt="" width="120" height="40" />
      <img id="unlabeled-img" src="https://example.com/unlabeled.png" loading="lazy" />
    `;

    const images = extractImages(document);

    expect(images.length).toBe(3);

    // Hero image
    expect(images[0].src).toBe('https://example.com/hero.jpg');
    expect(images[0].alt).toBe('Hero product banner');
    expect(images[0].hasAltText).toBe(true);
    expect(images[0].selector).toBe('#hero-img');

    // Logo image with empty alt
    expect(images[1].alt).toBe('');
    expect(images[1].hasAltText).toBe(false);

    // Unlabeled image without alt attribute
    expect(images[2].hasAltText).toBe(false);
    expect(images[2].loading).toBe('lazy');
  });
});
