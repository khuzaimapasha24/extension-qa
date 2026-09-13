import { describe, it, expect } from 'vitest';
import { SyntheticPersonaGenerator } from '../../src/qa/synthetic-persona';

describe('SyntheticPersonaGenerator', () => {
  it('generates standard consumer buyer persona with valid payment data', () => {
    const persona = SyntheticPersonaGenerator.generate('STANDARD_BUYER');

    expect(persona.archetype).toBe('STANDARD_BUYER');
    expect(persona.firstName).toBe('Alex');
    expect(persona.lastName).toBe('Morgan');
    expect(persona.email).toContain('@example.invalid');
    expect(persona.creditCardNumber).toBe('4000000000000002');
    expect(persona.postalCode).toBe('97477');
  });

  it('generates unicode and apostrophe edge-case persona to test sanitization', () => {
    const persona = SyntheticPersonaGenerator.generate('UNICODE_APOSTROPHE');

    expect(persona.archetype).toBe('UNICODE_APOSTROPHE');
    expect(persona.firstName).toContain('Renée');
    expect(persona.lastName).toContain("O'Connor-Müller");
    expect(persona.addressLine1).toContain("l'Échiquier");
    expect(persona.countryCode).toBe('FR');
  });

  it('generates extreme string length persona to test database buffer truncation', () => {
    const persona = SyntheticPersonaGenerator.generate('EXTREME_LENGTH');

    expect(persona.archetype).toBe('EXTREME_LENGTH');
    expect(persona.firstName.length).toBeGreaterThan(40);
    expect(persona.fullName.length).toBeGreaterThan(80);
    expect(persona.addressLine1.length).toBeGreaterThan(50);
  });

  it('generates leap year boundary persona (Feb 29) to test date picker validators', () => {
    const persona = SyntheticPersonaGenerator.generate('BOUNDARY_AGE_LEAP_YEAR');

    expect(persona.archetype).toBe('BOUNDARY_AGE_LEAP_YEAR');
    expect(persona.dateOfBirth).toBe('2000-02-29');
  });

  it('generates B2B enterprise persona with corporate VAT registration', () => {
    const persona = SyntheticPersonaGenerator.generate('B2B_ENTERPRISE');

    expect(persona.archetype).toBe('B2B_ENTERPRISE');
    expect(persona.companyName).toBeDefined();
    expect(persona.taxIdOrVat).toContain('DE');
  });

  it('provides all available archetypes list', () => {
    const list = SyntheticPersonaGenerator.getAllArchetypes();
    expect(list).toHaveLength(5);
    expect(list).toContain('STANDARD_BUYER');
    expect(list).toContain('UNICODE_APOSTROPHE');
    expect(list).toContain('EXTREME_LENGTH');
    expect(list).toContain('BOUNDARY_AGE_LEAP_YEAR');
    expect(list).toContain('B2B_ENTERPRISE');
  });
});
