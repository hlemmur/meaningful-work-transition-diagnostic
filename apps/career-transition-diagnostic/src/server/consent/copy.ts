export const PRODUCT_CONSENT_COPY_VERSION = "product-consent.v1";
export const MARKETING_CONSENT_COPY_VERSION = "marketing-consent.v1";

export type MarketingContact = {
  email: string;
  consentCopyVersion: string;
  consentedAt: string;
  source: string;
};

export type WelcomeConsentInput = {
  accessToken: string;
  productConsent: boolean;
  marketingOptIn: boolean;
};
