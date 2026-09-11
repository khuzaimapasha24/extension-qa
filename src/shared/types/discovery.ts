import { ActionRiskLevel } from './agent';

export interface PageMetadata {
  title: string;
  description?: string;
  canonical?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  lang?: string;
  charset?: string;
  viewport?: string;
  h1Count: number;
  h1Texts: string[];
  headingCounts: {
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
  };
}

export interface DiscoveredLink {
  href: string;
  normalizedUrl: string;
  text: string;
  isInternal: boolean;
  isAnchor: boolean;
  isMailtoOrTel: boolean;
  rel?: string;
  target?: string;
  selector: string;
}

export interface DiscoveredButton {
  text: string;
  type: string;
  ariaLabel?: string;
  role?: string;
  selector: string;
  isVisible: boolean;
  isDisabled: boolean;
  riskLevel: ActionRiskLevel;
}

export interface DiscoveredFormField {
  name: string;
  type: string;
  label?: string;
  placeholder?: string;
  required: boolean;
  defaultValue?: string;
  selector: string;
}

export interface DiscoveredForm {
  id?: string;
  name?: string;
  action: string;
  method: string;
  selector: string;
  fields: DiscoveredFormField[];
  submitButtonSelector?: string;
  riskLevel: ActionRiskLevel;
  isStandalone?: boolean;
  containerTag?: string;
}

export interface DiscoveredTab {
  text: string;
  role: string;
  selector: string;
  isActive: boolean;
  ariaControls?: string;
}

export interface DiscoveredImage {
  src: string;
  alt: string;
  hasAltText: boolean;
  naturalWidth: number;
  naturalHeight: number;
  isBroken: boolean;
  loading?: string;
  selector: string;
}

export interface DiscoveredNavigation {
  role: string;
  label?: string;
  linksCount: number;
  selector: string;
}

export interface PageSnapshot {
  url: string;
  origin: string;
  pathname: string;
  title: string;
  metadata: PageMetadata;
  links: DiscoveredLink[];
  buttons: DiscoveredButton[];
  forms: DiscoveredForm[];
  tabs?: DiscoveredTab[];
  images: DiscoveredImage[];
  navigations: DiscoveredNavigation[];
  totalInteractiveCount: number;
  timestamp: number;
}

export interface WebsiteDiscoveryMap {
  sessionId: string;
  rootUrl: string;
  origin: string;
  pages: PageSnapshot[];
  totalDiscoveredPages: number;
  totalInternalLinks: number;
  totalButtons: number;
  totalForms: number;
  totalImages: number;
  visitedUrls: string[];
  queue: string[];
}
