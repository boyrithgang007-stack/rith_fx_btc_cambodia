import type { ExchangeProvider } from "./types";

export type ExchangeAdapterErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "UNSUPPORTED_CAPABILITY"
  | "INVALID_UPSTREAM_RESPONSE";

export class ExchangeAdapterError extends Error {
  constructor(
    message: string,
    readonly code: ExchangeAdapterErrorCode,
    readonly provider: ExchangeProvider,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ExchangeAdapterError";
  }
}
