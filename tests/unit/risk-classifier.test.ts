import { describe, it, expect } from 'vitest';
import { classifyActionRisk } from '../../src/shared/constants/risk-levels';

describe('classifyActionRisk', () => {
  it('classifies payment and destructive actions as HIGH risk', () => {
    expect(classifyActionRisk('Click on checkout button', 'Submit Order')).toBe('HIGH');
    expect(classifyActionRisk('Enter credit card info')).toBe('HIGH');
    expect(classifyActionRisk('Click delete account', 'Delete')).toBe('HIGH');
    expect(classifyActionRisk('Update password field')).toBe('HIGH');
  });

  it('classifies form submissions as MEDIUM risk', () => {
    expect(classifyActionRisk('Submit contact form', 'Send Message')).toBe('MEDIUM');
    expect(classifyActionRisk('Sign up newsletter form')).toBe('MEDIUM');
  });

  it('classifies navigation and inspection actions as LOW risk', () => {
    expect(classifyActionRisk('Click main navigation', 'About Us')).toBe('LOW');
    expect(classifyActionRisk('Open mobile drawer menu')).toBe('LOW');
    expect(classifyActionRisk('Scroll page to bottom')).toBe('LOW');
    expect(classifyActionRisk('Toggle accordion tab')).toBe('LOW');
    expect(classifyActionRisk('Search query')).toBe('LOW');
  });
});
