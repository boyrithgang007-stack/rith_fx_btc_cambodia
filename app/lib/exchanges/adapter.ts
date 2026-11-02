import type {
  AccountSummary,
  AccountUpdate,
  AdapterCapabilities,
  AssetBalance,
  ExchangeProvider,
  HistoricalTrade,
  OpenPosition,
  TradeHistoryPage,
  TradeHistoryQuery,
} from "./types";

export interface IExchangeAdapter {
  readonly provider: ExchangeProvider;
  readonly capabilities: AdapterCapabilities;

  connect(signal?: AbortSignal): Promise<void>;
  getAccountSummary(signal?: AbortSignal): Promise<AccountSummary>;
  getBalances(signal?: AbortSignal): Promise<AssetBalance[]>;
  getOpenPositions(signal?: AbortSignal): Promise<OpenPosition[]>;
  getTradeHistory(query: TradeHistoryQuery, signal?: AbortSignal): Promise<TradeHistoryPage>;
  subscribeAccountUpdates(signal: AbortSignal): AsyncIterable<AccountUpdate>;
  disconnect(): Promise<void>;
}

export type ExchangeAdapterFactory = (context: AdapterContext) => IExchangeAdapter;

export type AdapterContext = {
  userId: string;
  connectionId: string;
  credentials: import("./types").ExchangeCredentials;
};

export type { HistoricalTrade };
