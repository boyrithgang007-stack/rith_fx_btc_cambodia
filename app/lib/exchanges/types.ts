export const EXCHANGE_PROVIDERS = ["binance", "bitget", "okx", "mt5"] as const;

export type ExchangeProvider = (typeof EXCHANGE_PROVIDERS)[number];
export type ExchangeAccountType = "spot" | "margin" | "futures" | "mt5";
export type PositionSide = "long" | "short";

export type ExchangeCredentials =
  | { provider: "binance" | "bitget" | "okx"; apiKey: string; apiSecret: string; passphrase?: string }
  | { provider: "mt5"; gatewayUrl: string; accessToken: string };

export type AccountSummary = {
  externalAccountId: string;
  accountType: ExchangeAccountType;
  currency: string;
  equity: string;
  available: string;
  marginUsed: string | null;
  unrealizedPnl: string | null;
  observedAt: string;
};

export type AssetBalance = {
  asset: string;
  total: string;
  available: string;
  locked: string;
  usdValue: string | null;
};

export type OpenPosition = {
  externalPositionId: string;
  instrument: string;
  side: PositionSide;
  quantity: string;
  entryPrice: string;
  markPrice: string | null;
  liquidationPrice: string | null;
  unrealizedPnl: string | null;
  leverage: string | null;
  currency: string;
  openedAt: string | null;
};

export type HistoricalTrade = {
  externalTradeId: string;
  instrument: string;
  side: PositionSide;
  quantity: string;
  price: string;
  fee: string | null;
  feeCurrency: string | null;
  realizedPnl: string | null;
  currency: string;
  executedAt: string;
};

export type TradeHistoryQuery = {
  from: string;
  to: string;
  cursor?: string;
  limit: number;
};

export type TradeHistoryPage = {
  trades: HistoricalTrade[];
  nextCursor: string | null;
};

export type AccountUpdate =
  | { type: "snapshot"; observedAt: string; account: AccountSummary; balances: AssetBalance[]; positions: OpenPosition[] }
  | { type: "balance"; observedAt: string; balance: AssetBalance }
  | { type: "position"; observedAt: string; position: OpenPosition }
  | { type: "position-closed"; observedAt: string; externalPositionId: string };

export type AdapterCapabilities = {
  accountSummary: boolean;
  balances: boolean;
  openPositions: boolean;
  tradeHistory: boolean;
  accountStream: boolean;
};
