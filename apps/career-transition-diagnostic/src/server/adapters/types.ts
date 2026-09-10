export type CheckoutRequest = {
  email: string;
};

export type CheckoutResult = {
  checkoutUrl: string;
  orderId: string;
};

export type StructuredLlmRequest = {
  stage: string;
  input: Record<string, unknown>;
};

export type StructuredLlmResult = {
  stage: string;
  fixture: string;
  output: Record<string, unknown>;
};

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type OutboxEmail = EmailMessage & {
  sentAt: string;
};

export type CommerceAdapter = {
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
};

export type LlmAdapter = {
  completeStructured(request: StructuredLlmRequest): Promise<StructuredLlmResult>;
};

export type EmailAdapter = {
  send(message: EmailMessage): Promise<void>;
  listOutbox(): OutboxEmail[];
};

export type VendorAdapters = {
  commerce: CommerceAdapter;
  llm: LlmAdapter;
  email: EmailAdapter;
};
