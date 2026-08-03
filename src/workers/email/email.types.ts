export type EmailPayload = {
  from?: string;
  html?: string;
  metadata?: Record<string, unknown>;
  subject: string;
  text: string;
  to: string | string[];
};

export type NormalizedEmail = {
  from: string;
  html?: string;
  metadata?: Record<string, unknown>;
  subject: string;
  text: string;
  to: string[];
};

export type EmailProviderPort = {
  send(email: NormalizedEmail): Promise<unknown>;
};

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
