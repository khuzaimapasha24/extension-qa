import { PageSnapshot } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';

export function testSEO(snapshot: PageSnapshot, sessionId: string): Finding[] {
  const findings: Finding[] = [];
  const meta = snapshot.metadata;

  // 1. Title checks
  if (!meta.title || meta.title.trim().length === 0) {
    findings.push({
      id: `seo_no_title_${Date.now()}`,
      sessionId,
      category: 'SEO',
      title: 'Missing <title> tag',
      description: 'Document has no <title> tag, heavily damaging search ranking and tab identification.',
      status: 'FAIL',
      severity: 'CRITICAL',
      confidence: 1.0,
      page: snapshot.pathname,
      evidence: [],
      steps: ['Inspect document <head>', 'Check for presence of <title> element'],
      expected: 'Document must contain a unique descriptive <title> element.',
      actual: 'No title element found.',
      recommendation: 'Add a concise <title> describing the page and brand (between 30 and 60 characters).',
      retestCount: 0,
      timestamp: Date.now(),
    });
  } else {
    const len = meta.title.trim().length;
    if (len < 10) {
      findings.push({
        id: `seo_short_title_${Date.now()}`,
        sessionId,
        category: 'SEO',
        title: 'Title tag too short (< 10 characters)',
        description: `Title "${meta.title}" is only ${len} characters long and may lack descriptive keywords.`,
        status: 'WARNING',
        severity: 'LOW',
        confidence: 0.9,
        page: snapshot.pathname,
        evidence: [{ type: 'dom_snippet', description: 'Title content', data: meta.title, timestamp: Date.now() }],
        steps: ['Count characters in <title>'],
        expected: 'Title should typically be 30–60 characters long.',
        actual: `${len} characters.`,
        recommendation: 'Expand title with relevant keywords and brand name.',
        retestCount: 0,
        timestamp: Date.now(),
      });
    } else if (len > 70) {
      findings.push({
        id: `seo_long_title_${Date.now()}`,
        sessionId,
        category: 'SEO',
        title: 'Title tag may be truncated in search results (> 70 characters)',
        description: `Title length is ${len} characters. Most search engines truncate titles beyond ~60–70 characters.`,
        status: 'WARNING',
        severity: 'LOW',
        confidence: 0.85,
        page: snapshot.pathname,
        evidence: [{ type: 'dom_snippet', description: 'Title content', data: meta.title, timestamp: Date.now() }],
        steps: ['Count characters in <title>'],
        expected: 'Title should be under 60–70 characters to avoid snippet truncation.',
        actual: `${len} characters.`,
        recommendation: 'Shorten title tag to keep primary keywords visible in SERP previews.',
        retestCount: 0,
        timestamp: Date.now(),
      });
    }
  }

  // 2. Meta description
  if (!meta.description || meta.description.trim().length === 0) {
    findings.push({
      id: `seo_no_desc_${Date.now()}`,
      sessionId,
      category: 'SEO',
      title: 'Missing meta description tag',
      description: 'Document does not define a meta name="description", leaving snippet selection to search engine algorithms.',
      status: 'WARNING',
      severity: 'MEDIUM',
      confidence: 0.95,
      page: snapshot.pathname,
      evidence: [],
      steps: ['Inspect <head> for meta[name="description"]'],
      expected: 'Pages should define a compelling meta description between 50 and 160 characters.',
      actual: 'Meta description missing.',
      recommendation: 'Add <meta name="description" content="..."> summarizing the page content.',
      retestCount: 0,
      timestamp: Date.now(),
    });
  }

  // 3. Heading hierarchy: H1 check
  if (meta.h1Count === 0) {
    findings.push({
      id: `seo_no_h1_${Date.now()}`,
      sessionId,
      category: 'SEO',
      title: 'Missing <h1> heading',
      description: 'Page contains no top-level <h1> heading, obscuring main topic hierarchy for crawlers and screen readers.',
      status: 'FAIL',
      severity: 'HIGH',
      confidence: 1.0,
      page: snapshot.pathname,
      evidence: [],
      steps: ['Query document for <h1> elements'],
      expected: 'Each webpage should feature a single <h1> heading describing the main page topic.',
      actual: '0 <h1> elements found.',
      recommendation: 'Add a prominent <h1> heading near the top of the main content.',
      retestCount: 0,
      timestamp: Date.now(),
    });
  } else if (meta.h1Count > 1) {
    findings.push({
      id: `seo_multiple_h1_${Date.now()}`,
      sessionId,
      category: 'SEO',
      title: `Multiple <h1> headings found (${meta.h1Count})`,
      description: 'Having multiple <h1> tags dilutes the primary topic hierarchy.',
      status: 'WARNING',
      severity: 'LOW',
      confidence: 0.88,
      page: snapshot.pathname,
      evidence: [{ type: 'dom_snippet', description: 'H1 tags list', data: { headings: meta.h1Texts }, timestamp: Date.now() }],
      steps: ['Query document for <h1> elements'],
      expected: 'One semantic <h1> per page is standard best practice.',
      actual: `${meta.h1Count} <h1> elements found.`,
      recommendation: 'Reserve <h1> for the main page title and use <h2> for subsections.',
      retestCount: 0,
      timestamp: Date.now(),
    });
  }

  // 4. Canonical link
  if (!meta.canonical) {
    findings.push({
      id: `seo_no_canonical_${Date.now()}`,
      sessionId,
      category: 'SEO',
      title: 'Missing canonical link tag',
      description: 'No <link rel="canonical"> tag detected, creating risk of duplicate content indexing if parameters vary.',
      status: 'WARNING',
      severity: 'LOW',
      confidence: 0.9,
      page: snapshot.pathname,
      evidence: [],
      steps: ['Check <head> for link[rel="canonical"]'],
      expected: 'Canonical URLs should be specified to clarify definitive indexing destination.',
      actual: 'Canonical link tag not specified.',
      recommendation: 'Add <link rel="canonical" href="..."> pointing to the authoritative URL.',
      retestCount: 0,
      timestamp: Date.now(),
    });
  }

  // 5. OpenGraph tags
  if (!meta.ogTitle || !meta.ogImage) {
    findings.push({
      id: `seo_incomplete_og_${Date.now()}`,
      sessionId,
      category: 'SEO',
      title: 'Incomplete OpenGraph metadata (missing og:title or og:image)',
      description: 'Social sharing previews (Slack, Twitter, LinkedIn) will lack rich images or titles when shared.',
      status: 'WARNING',
      severity: 'LOW',
      confidence: 0.85,
      page: snapshot.pathname,
      evidence: [],
      steps: ['Check for meta[property="og:title"] and meta[property="og:image"]'],
      expected: 'Both og:title and og:image should be provided for optimal social sharing.',
      actual: `og:title: ${meta.ogTitle ? 'present' : 'missing'}, og:image: ${meta.ogImage ? 'present' : 'missing'}`,
      recommendation: 'Add og:title and og:image metadata tags.',
      retestCount: 0,
      timestamp: Date.now(),
    });
  }

  return findings;
}
