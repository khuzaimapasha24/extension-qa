export type PersonaLocale = 'en-US' | 'fr-FR' | 'de-DE' | 'es-ES' | 'ar-SA' | 'ja-JP';

export type PersonaArchetype =
  | 'STANDARD_BUYER'
  | 'UNICODE_APOSTROPHE'
  | 'EXTREME_LENGTH'
  | 'BOUNDARY_AGE_LEAP_YEAR'
  | 'B2B_ENTERPRISE';

export interface SyntheticPersona {
  archetype: PersonaArchetype;
  locale: PersonaLocale;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  stateOrRegion: string;
  postalCode: string;
  country: string;
  countryCode: string;
  dateOfBirth: string; // YYYY-MM-DD
  companyName?: string;
  taxIdOrVat?: string;
  creditCardNumber?: string;
  creditCardExpiry?: string;
  creditCardCvv?: string;
  notes?: string;
}

/**
 * Synthetic Persona Generator for Advanced Level 5 QA.
 * Produces cohesive, culturally authentic, and edge-case testing personas to challenge
 * form sanitization, character encoding, length limits, and business logic.
 */
export class SyntheticPersonaGenerator {
  public static generate(
    archetype: PersonaArchetype = 'STANDARD_BUYER',
    locale: PersonaLocale = 'en-US'
  ): SyntheticPersona {
    const timestamp = Date.now().toString(36);

    switch (archetype) {
      case 'UNICODE_APOSTROPHE':
        return {
          archetype,
          locale: 'fr-FR',
          firstName: "Renée-Marie",
          lastName: "O'Connor-Müller",
          fullName: "Renée-Marie O'Connor-Müller",
          email: `renee.o'connor_${timestamp}@example.invalid`,
          phone: '+33 1 42 68 55 00',
          addressLine1: "15bis Rue de l'Échiquier, Apt #4-C (D'Amboise)",
          city: 'Paris',
          stateOrRegion: 'Île-de-France',
          postalCode: '75010',
          country: 'France',
          countryCode: 'FR',
          dateOfBirth: '1992-07-14',
          notes: "Testing accents & apostrophes: O'Connor, René, Müller, & 'quotes'",
        };

      case 'EXTREME_LENGTH':
        const longFirstName = 'Hubert-Blaine-Wolfeschlegelsteinhausenbergerdorff';
        const longLastName = 'von-Hohenzollern-Sigmaringen-Brandenburg-Ansbach';
        return {
          archetype,
          locale: 'de-DE',
          firstName: longFirstName,
          lastName: longLastName,
          fullName: `${longFirstName} ${longLastName}`,
          email: `extremely.long.qa.persona.buffer.overflow.check_${timestamp}@example.invalid`,
          phone: '+49 89 1234567890123',
          addressLine1: 'Grossherzoglich-Badische-Strasse-Der-Befreiungskriege 987654321',
          city: 'Garmisch-Partenkirchen-Oberbayern',
          stateOrRegion: 'Freistaat Bayern',
          postalCode: '82467',
          country: 'Germany',
          countryCode: 'DE',
          dateOfBirth: '1985-11-23',
          notes: 'Buffer overflow and UI truncation testing persona with 100+ character strings.',
        };

      case 'BOUNDARY_AGE_LEAP_YEAR':
        return {
          archetype,
          locale: 'en-US',
          firstName: 'LeapDay',
          lastName: 'Baby',
          fullName: 'LeapDay Baby',
          email: `leap.year.qa_${timestamp}@example.invalid`,
          phone: '+1 555 029 2000',
          addressLine1: '29 February Way',
          city: 'Greenwich',
          stateOrRegion: 'CT',
          postalCode: '06830',
          country: 'United States',
          countryCode: 'US',
          dateOfBirth: '2000-02-29', // Valid leap year date
          notes: 'Tests leap year date validator boundary logic (Feb 29).',
        };

      case 'B2B_ENTERPRISE':
        return {
          archetype,
          locale: 'de-DE',
          firstName: 'Maximilian',
          lastName: 'Schneider',
          fullName: 'Maximilian Schneider',
          email: `procurement_${timestamp}@global-logistics-corp.invalid`,
          phone: '+49 30 987654-20',
          addressLine1: 'Industriepark Nord 42, Tor 3',
          city: 'Frankfurt am Main',
          stateOrRegion: 'Hessen',
          postalCode: '60311',
          country: 'Germany',
          countryCode: 'DE',
          companyName: 'Global Logistics & Supply Chain Solutions GmbH',
          taxIdOrVat: 'DE293847561',
          dateOfBirth: '1978-04-12',
          notes: 'B2B persona with corporate VAT tax ID and company procurement credentials.',
        };

      case 'STANDARD_BUYER':
      default:
        return {
          archetype: 'STANDARD_BUYER',
          locale: 'en-US',
          firstName: 'Alex',
          lastName: 'Morgan',
          fullName: 'Alex Morgan',
          email: `alex.qa_${timestamp}@example.invalid`,
          phone: '+1 555 234 5678',
          addressLine1: '742 Evergreen Terrace',
          city: 'Springfield',
          stateOrRegion: 'OR',
          postalCode: '97477',
          country: 'United States',
          countryCode: 'US',
          dateOfBirth: '1995-09-15',
          creditCardNumber: '4000000000000002', // Standard Stripe test card
          creditCardExpiry: '12/28',
          creditCardCvv: '123',
          notes: 'Standard consumer buyer profile for e-commerce checkout flows.',
        };
    }
  }

  public static getAllArchetypes(): PersonaArchetype[] {
    return [
      'STANDARD_BUYER',
      'UNICODE_APOSTROPHE',
      'EXTREME_LENGTH',
      'BOUNDARY_AGE_LEAP_YEAR',
      'B2B_ENTERPRISE',
    ];
  }
}
