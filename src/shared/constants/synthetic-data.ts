/**
 * Safe synthetic test data for automated form QA.
 * Uses RFC 2606 reserved domains (.invalid) to ensure test data can never leak
 * to real mailservers or external services.
 */
export const SYNTHETIC_TEST_DATA = {
  name: 'QA Test User',
  firstName: 'QA',
  lastName: 'Tester',
  email: 'qa-test@example.invalid',
  invalidEmail: 'invalid-qa-email-format',
  phone: '0000000000',
  address: '123 QA Test Street',
  city: 'Testville',
  state: 'TS',
  zip: '00000',
  country: 'US',
  comment: '[QA Automated Synthetic Test Message - Non-Destructive Verification]',
  searchQuery: 'qa test query',
  password: 'SafeTestDummyPass#2026!',
  date: '2026-05-15',
  time: '10:30',
  number: '42',
  url: 'https://example.invalid',
};

export interface FieldContext {
  name?: string;
  type?: string;
  placeholder?: string;
  label?: string;
  selector?: string;
}

/**
 * Intelligent multi-lingual synthetic value generator.
 * Accurately detects field semantics across English, French, Spanish, and German,
 * and formats valid RFC 2606 / ISO compliant test strings.
 */
export function generateSyntheticValue(field: FieldContext): string {
  const type = (field.type || 'text').toLowerCase();
  const name = (field.name || '').toLowerCase();
  const placeholder = (field.placeholder || '').toLowerCase();
  const label = (field.label || '').toLowerCase();
  const selector = (field.selector || '').toLowerCase();

  const context = `${type} ${name} ${placeholder} ${label} ${selector}`;

  // 1. Strict HTML5 Input Types
  if (type === 'email' || /email|courriel|mail|mel\b/i.test(context)) {
    return SYNTHETIC_TEST_DATA.email;
  }

  if (type === 'password' || /password|mot[-_ ]?de[-_ ]?passe|passe|passwort|contraseña/i.test(context)) {
    return SYNTHETIC_TEST_DATA.password;
  }

  if (type === 'tel' || /phone|t[eé]l[eé]?phone|mobile|portable|cell|telefon|telefono/i.test(context)) {
    return '0123456789';
  }

  if (type === 'date' || /^(?:birth[-_]?date|dob|date[-_]?naissance|date)$/i.test(name)) {
    return SYNTHETIC_TEST_DATA.date;
  }

  if (type === 'time') {
    return SYNTHETIC_TEST_DATA.time;
  }

  if (type === 'datetime-local') {
    return `${SYNTHETIC_TEST_DATA.date}T${SYNTHETIC_TEST_DATA.time}`;
  }

  if (type === 'url' || /website|site[-_ ]?web|url|lien/i.test(context)) {
    return SYNTHETIC_TEST_DATA.url;
  }

  if (type === 'number' || /quantit[eé]|quantity|qty|montant|amount|prix|price|\bage\b/i.test(context)) {
    if (/prix|price|montant|amount/i.test(context)) return '49.99';
    if (/\bage\b/i.test(context)) return '28';
    return SYNTHETIC_TEST_DATA.number;
  }

  // 2. Multi-lingual Name Fields (English, French, Spanish, German)
  if (/first[-_ ]?name|pr[eé]nom|vorname|primer[-_ ]?nombre/i.test(context)) {
    return 'Alexandre';
  }

  if (/last[-_ ]?name|nom[-_ ]*(?:de[-_ ]*)?famille|nachname|apellido/i.test(context) || (/\bnom\b/i.test(context) && !/pr[eé]nom/i.test(context) && !/complet|full/i.test(context))) {
    return 'Dupont';
  }

  if (/user[-_ ]?name|pseudo|identifiant|benutzername/i.test(context)) {
    return 'qa_tester_2026';
  }

  if (/\bname\b|\bnom\b|nom[-_ ]?complet|full[-_ ]?name/i.test(context)) {
    return 'Alexandre Dupont';
  }

  // 3. Address & Geographical Fields
  if (/zip|postal|code[-_ ]?postal|plz|c[oó]digo[-_ ]?postal/i.test(context)) {
    return '75001';
  }

  if (/city|ville|stadt|ciudad|commune/i.test(context)) {
    return 'Paris';
  }

  if (/country|pays|land\b|pa[ií]s/i.test(context)) {
    return 'France';
  }

  if (/address|adresse|rue|strasse|calle|voie/i.test(context)) {
    return '10 Rue de la Paix';
  }

  // 4. Business, Role & Organizational Fields
  if (/company|soci[eé]t[eé]|entreprise|firma|empresa|organisation/i.test(context)) {
    return 'Acme QA Corp';
  }

  if (/title|titre|titel|t[ií]tulo|subject|sujet|objet/i.test(context)) {
    return 'Test QA Subject';
  }

  if (/role|poste|fonction|position|profession/i.test(context)) {
    return 'Responsable QA';
  }

  // 5. Search & Query Fields
  if (type === 'search' || /search|recherche|suche|buscar|query|q\b/i.test(context)) {
    return SYNTHETIC_TEST_DATA.searchQuery;
  }

  // 6. Textarea & Long Message Fields
  if (type === 'textarea' || /comment|message|remarque|feedback|description|note|avis/i.test(context)) {
    return SYNTHETIC_TEST_DATA.comment;
  }

  // Safe fallback for generic text inputs
  return 'QA Test Data';
}
