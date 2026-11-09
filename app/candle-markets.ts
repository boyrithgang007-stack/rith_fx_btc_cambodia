export const CANDLE_MARKETS = {
  BTCUSDT:{label:"BTC / USDT",tv:"BINANCE:BTCUSDT",provider:"binance",symbol:"BTCUSDT"},
  ETHUSDT:{label:"ETH / USDT",tv:"BINANCE:ETHUSDT",provider:"binance",symbol:"ETHUSDT"},
  XAUUSD:{label:"Gold · XAU / USD",tv:"OANDA:XAUUSD",provider:"twelvedata",symbol:"XAU/USD"},
  XAGUSD:{label:"Silver · XAG / USD",tv:"OANDA:XAGUSD",provider:"twelvedata",symbol:"XAG/USD"},
  WTIUSD:{label:"WTI oil / USD",tv:"TVC:USOIL",provider:"twelvedata",symbol:"WTI/USD"},
  BRENTUSD:{label:"Brent oil / USD",tv:"TVC:UKOIL",provider:"twelvedata",symbol:"XBR/USD"},
  EURUSD:{label:"EUR / USD",tv:"OANDA:EURUSD",provider:"twelvedata",symbol:"EUR/USD"},
  GBPUSD:{label:"GBP / USD",tv:"OANDA:GBPUSD",provider:"twelvedata",symbol:"GBP/USD"},
  USDJPY:{label:"USD / JPY",tv:"OANDA:USDJPY",provider:"twelvedata",symbol:"USD/JPY"},
} as const;
export const CANDLE_FRAMES = {
  "5m":{label:"5m",tv:"5",td:"5min",ms:300000},
  "15m":{label:"15m",tv:"15",td:"15min",ms:900000},
  "1h":{label:"1h",tv:"60",td:"1h",ms:3600000},
  "4h":{label:"4h",tv:"240",td:"4h",ms:14400000},
} as const;
export type CandleMarket = keyof typeof CANDLE_MARKETS;
export type CandleFrame = keyof typeof CANDLE_FRAMES;
