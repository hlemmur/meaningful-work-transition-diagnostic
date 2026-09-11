export const PRODUCT_CONSENT_COPY = {
  version: "product-consent.v1",
  title: "A note from Lena",
  intro:
    "You will move through this at your own pace. I read every draft before anything reaches you. The consent below is for this diagnostic. Marketing is optional and off unless you choose it.",
  scope: {
    heading: "What this is",
    body: "The Meaningful Work Transition Diagnostic is a paid, self-paced career-transition diagnostic. You answer questions over a private link. After you submit, Lena reviews a draft before anything is sent to you. It is not a job-placement service and it does not create a customer account.",
  },
  aiProcessing: {
    heading: "How AI is used",
    body: "Your answers are processed with artificial intelligence (AI) tools to draft the report. A human reviews that draft and can edit it before you receive it. The draft is a working hypothesis, not a diagnosis or a verdict about who you are.",
  },
  coachingNotTherapy: {
    heading: "Coaching, not therapy",
    body: "This product is not coaching, not therapy, and not medical or crisis care. It does not replace a licensed clinician. If you are in crisis, contact local emergency services or a crisis line in your area.",
  },
  privacy: {
    heading: "Privacy notes",
    retention:
      "Raw answers are kept for 90 days after you submit, then deleted. Purchase and delivery records may be kept longer where bookkeeping law requires it.",
    deletion:
      "You can email contact@radicalcreationcoaching.com to ask us to delete your assessment data sooner. We will confirm when it is gone.",
    analytics:
      "We do not send answers, report text, or safety notes to analytics. Transactional emails about this purchase are not marketing.",
  },
  checkboxLabel:
    "I have read the scope, AI disclosure, coaching-not-therapy disclaimer, and privacy notes. I consent to this assessment and to human review of my answers.",
} as const;

export const MARKETING_CONSENT_COPY = {
  version: "marketing-consent.v1",
  checkboxLabel:
    "Email me occasional notes from Radical Creation Coaching. This is optional and not required to take the assessment. Leave this unchecked unless you want that.",
  withdrawal:
    "You can withdraw later by emailing contact@radicalcreationcoaching.com. Marketing records never include diagnostic content.",
} as const;

export const PRODUCT_CONSENT_COPY_VERSION = PRODUCT_CONSENT_COPY.version;
export const MARKETING_CONSENT_COPY_VERSION = MARKETING_CONSENT_COPY.version;

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
