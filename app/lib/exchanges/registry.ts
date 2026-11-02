import type { AdapterContext, ExchangeAdapterFactory, IExchangeAdapter } from "./adapter";
import { ExchangeAdapterError } from "./errors";
import type { ExchangeProvider } from "./types";

export class ExchangeAdapterRegistry {
  private readonly factories = new Map<ExchangeProvider, ExchangeAdapterFactory>();

  register(provider: ExchangeProvider, factory: ExchangeAdapterFactory) {
    if (this.factories.has(provider)) throw new Error(`An adapter is already registered for ${provider}.`);
    this.factories.set(provider, factory);
  }

  create(provider: ExchangeProvider, context: AdapterContext): IExchangeAdapter {
    if (context.credentials.provider !== provider) throw new Error("Adapter provider and credential provider must match.");
    const factory = this.factories.get(provider);
    if (!factory) {
      throw new ExchangeAdapterError(
        `${provider} integration is not configured.`,
        "PROVIDER_NOT_CONFIGURED",
        provider,
        false,
      );
    }
    return factory(context);
  }
}
