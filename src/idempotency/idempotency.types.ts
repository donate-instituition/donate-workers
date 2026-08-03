export type IdempotencyStorePort = {
  hasCompleted(idempotencyKey: string): Promise<boolean>;
  markCompleted(idempotencyKey: string): Promise<void>;
};

export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');
