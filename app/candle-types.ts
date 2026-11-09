import type { CandleMarket,CandleFrame } from "./candle-markets";
import type { Candle,Signal } from "./strategy";
import type { MarketPressure } from "./lib/market-pressure";
export type AiCandleReview={status:"not_requested"|"reviewed"|"unavailable";consistent:boolean|null;summary:string;risks:string[];observations:string[]};
export type CandleAnalysisReport={id:string;market:CandleMarket;frame:CandleFrame;source:string;rewardRatio?:2|3;generatedAt:number;asOf:number|null;expiresAt:number|null;candles:Candle[];trend:string;ema:number[];signal:Pick<Signal,"action"|"reason"|"entry"|"stopLoss"|"takeProfit"|"checks">;ai:AiCandleReview;volumeAvailable:boolean;pressure:MarketPressure};
