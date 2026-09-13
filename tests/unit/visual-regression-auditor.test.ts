import { describe, it, expect, beforeEach } from 'vitest';
import { VisualRegressionAuditor } from '../../src/qa/visual-regression-auditor';

describe('VisualRegressionAuditor', () => {
  let auditor: VisualRegressionAuditor;
  let doc: Document;

  beforeEach(() => {
    auditor = new VisualRegressionAuditor();
    doc = document.implementation.createHTMLDocument('Visual Test Page');
  });

  it('detects broken images with empty src, hash, or failed width', () => {
    const validImg = doc.createElement('img');
    validImg.setAttribute('src', 'https://example.com/logo.png');
    validImg.setAttribute('alt', 'Company Logo');
    Object.defineProperty(validImg, 'naturalWidth', { value: 200 });
    Object.defineProperty(validImg, 'complete', { value: true });
    doc.body.appendChild(validImg);

    const emptyImg = doc.createElement('img');
    emptyImg.setAttribute('src', '');
    emptyImg.setAttribute('id', 'broken-empty');
    doc.body.appendChild(emptyImg);

    const hashImg = doc.createElement('img');
    hashImg.setAttribute('src', '#');
    hashImg.setAttribute('class', 'avatar broken');
    doc.body.appendChild(hashImg);

    const zeroNaturalImg = doc.createElement('img');
    zeroNaturalImg.setAttribute('src', 'https://example.com/missing.jpg');
    Object.defineProperty(zeroNaturalImg, 'naturalWidth', { value: 0 });
    Object.defineProperty(zeroNaturalImg, 'complete', { value: true });
    doc.body.appendChild(zeroNaturalImg);

    const findings = auditor.audit(doc, 'https://example.com', 'sess-1', {
      checkTypographyHierarchy: false,
      checkHorizontalOverflow: false,
      checkOccludedElements: false,
    });

    expect(findings.length).toBe(3);
    expect(findings.every((f) => f.title.includes('[Visual Defect] Broken or Missing Image Asset'))).toBe(true);
  });

  it('flags missing H1 tag as a visual hierarchy issue', () => {
    // Only add H2 and H3, omitting H1
    const h2 = doc.createElement('h2');
    h2.textContent = 'Subheading without primary title';
    doc.body.appendChild(h2);

    const findings = auditor.audit(doc, 'https://example.com', 'sess-2', {
      checkBrokenImages: false,
      checkHorizontalOverflow: false,
      checkOccludedElements: false,
    });

    const h1MissingFinding = findings.find((f) => f.title.includes('Missing Primary Heading (H1)'));
    expect(h1MissingFinding).toBeDefined();
    expect(h1MissingFinding?.category).toBe('ACCESSIBILITY');
  });

  it('flags excessive H1 tags when more than two are present', () => {
    for (let i = 1; i <= 4; i++) {
      const h1 = doc.createElement('h1');
      h1.textContent = `Heading 1 Instance ${i}`;
      doc.body.appendChild(h1);
    }

    const findings = auditor.audit(doc, 'https://example.com', 'sess-3', {
      checkBrokenImages: false,
      checkHorizontalOverflow: false,
      checkOccludedElements: false,
    });

    const excessiveFinding = findings.find((f) => f.title.includes('Excessive Top-Level Headings'));
    expect(excessiveFinding).toBeDefined();
    expect(excessiveFinding?.description).toContain('4 separate <h1> tags');
  });

  it('flags zero-dimension unclickable buttons that are not marked hidden', () => {
    const normalBtn = doc.createElement('button');
    normalBtn.textContent = 'Click Me';
    normalBtn.getBoundingClientRect = () => ({
      width: 120,
      height: 40,
      top: 10,
      left: 10,
      bottom: 50,
      right: 130,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    });
    doc.body.appendChild(normalBtn);

    const zeroBtn = doc.createElement('button');
    zeroBtn.textContent = 'Invisible Button';
    zeroBtn.id = 'zero-btn';
    zeroBtn.getBoundingClientRect = () => ({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    doc.body.appendChild(zeroBtn);

    const hiddenBtn = doc.createElement('button');
    hiddenBtn.textContent = 'Legitimately Hidden';
    hiddenBtn.setAttribute('hidden', '');
    hiddenBtn.getBoundingClientRect = () => ({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    doc.body.appendChild(hiddenBtn);

    const findings = auditor.audit(doc, 'https://example.com', 'sess-4', {
      checkBrokenImages: false,
      checkTypographyHierarchy: false,
      checkHorizontalOverflow: false,
      checkOccludedElements: true,
    });

    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain('Collapsed / Zero-Dimension Interactive Button');
    expect(findings[0].elementSelector).toBe('#zero-btn');
  });

  it('handles null document safely', () => {
    // @ts-expect-error test null doc
    const findings = auditor.audit(null, 'https://example.com', 'sess-5');
    expect(findings).toEqual([]);
  });
});
