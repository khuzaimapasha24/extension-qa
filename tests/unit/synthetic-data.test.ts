import { describe, it, expect } from 'vitest';
import { generateSyntheticValue, SYNTHETIC_TEST_DATA } from '../../src/shared/constants/synthetic-data';

describe('Synthetic Data Generator', () => {
  it('generates multi-lingual name and contact fields (French, English)', () => {
    // French name fields
    expect(generateSyntheticValue({ name: 'prenom', label: 'Prénom' })).toBe('Alexandre');
    expect(generateSyntheticValue({ name: 'nom', label: 'Nom de famille' })).toBe('Dupont');
    expect(generateSyntheticValue({ name: 'courriel', placeholder: 'votre.courriel@example.com' })).toBe(SYNTHETIC_TEST_DATA.email);
    expect(generateSyntheticValue({ name: 'mot_de_passe', type: 'password' })).toBe(SYNTHETIC_TEST_DATA.password);
    expect(generateSyntheticValue({ name: 'telephone', label: 'Numéro de téléphone' })).toBe('0123456789');

    // English name fields
    expect(generateSyntheticValue({ name: 'first_name', label: 'First Name' })).toBe('Alexandre');
    expect(generateSyntheticValue({ name: 'email', type: 'email' })).toBe(SYNTHETIC_TEST_DATA.email);
  });

  it('generates format-strict values for date, time, and numeric inputs', () => {
    expect(generateSyntheticValue({ type: 'date', name: 'birthdate' })).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(generateSyntheticValue({ type: 'time', name: 'appointment_time' })).toMatch(/^\d{2}:\d{2}$/);
    expect(generateSyntheticValue({ type: 'number', name: 'quantite' })).toBe('42');
    expect(generateSyntheticValue({ type: 'number', name: 'prix_total' })).toBe('49.99');
  });

  it('generates search and comment values for search and textarea inputs', () => {
    expect(generateSyntheticValue({ type: 'search', name: 'recherche' })).toBe(SYNTHETIC_TEST_DATA.searchQuery);
    expect(generateSyntheticValue({ type: 'textarea', name: 'message' })).toBe(SYNTHETIC_TEST_DATA.comment);
  });
});
