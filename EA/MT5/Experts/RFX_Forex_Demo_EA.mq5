#property strict
#property version   "1.00"
#property description "RFX Forex demo EA: closed M15 EMA20/RSI14 signal, closed H1 EMA20 filter, ATR stop and 2R target. Demo accounts only."

#include <Trade/Trade.mqh>

input bool   InpEnableTrading       = false;
input double InpRiskPercent         = 0.50;
input double InpStopAtrMultiplier   = 1.50;
input double InpMaxDailyLossPercent = 3.00;
input int    InpMaxSpreadPoints     = 50;
input ulong  InpMagicNumber         = 26061101;
input int    InpDeviationPoints     = 20;

const int    SIGNAL_PERIOD_MINUTES = 15;
const int    EMA_PERIOD = 20;
const int    RSI_PERIOD = 14;
const int    ATR_PERIOD = 14;
const int    HISTORY_M15 = 500;
const int    HISTORY_H1 = 160;
const double REWARD_RISK = 2.0;

CTrade trade;
datetime lastBarTime = 0;
string dailyBaselineKey = "";

bool IsSupportedSymbol()
{
   string base = StringSubstr(_Symbol, 0, 6);
   return base == "EURUSD" || base == "GBPUSD" || base == "USDJPY" || base == "XAUUSD";
}

double EmaAt(const MqlRates &bars[], const int count, const int shift, const int period)
{
   const int target = count - 1 - shift;
   if(target < period - 1 || target < 0)
      return EMPTY_VALUE;

   double value = bars[count - 1].close;
   const double alpha = 2.0 / (period + 1.0);
   for(int i = 1; i <= target; ++i)
      value = bars[count - 1 - i].close * alpha + value * (1.0 - alpha);
   return value;
}

double SimpleRsiAt(const MqlRates &bars[], const int count, const int shift, const int period)
{
   const int target = count - 1 - shift;
   if(target < period || target < 0)
      return EMPTY_VALUE;

   double gain = 0.0;
   double loss = 0.0;
   for(int i = target - period + 1; i <= target; ++i)
   {
      const double current = bars[count - 1 - i].close;
      const double previous = bars[count - i].close;
      const double change = current - previous;
      gain += MathMax(change, 0.0);
      loss += MathMax(-change, 0.0);
   }
   if(gain == 0.0 && loss == 0.0)
      return 50.0;
   if(loss == 0.0)
      return 100.0;
   return 100.0 - 100.0 / (1.0 + gain / loss);
}

double SimpleAtrAt(const MqlRates &bars[], const int count, const int shift, const int period)
{
   const int target = count - 1 - shift;
   if(target < period - 1 || target < 0)
      return EMPTY_VALUE;

   double total = 0.0;
   for(int i = target - period + 1; i <= target; ++i)
   {
      const MqlRates candle = bars[count - 1 - i];
      const double previousClose = i > 0 ? bars[count - i].close : candle.close;
      total += MathMax(candle.high - candle.low,
                       MathMax(MathAbs(candle.high - previousClose), MathAbs(candle.low - previousClose)));
   }
   return total / period;
}

bool ReadPriceHistory(MqlRates &m15[], MqlRates &h1[])
{
   ArraySetAsSeries(m15, true);
   ArraySetAsSeries(h1, true);
   const int count15 = CopyRates(_Symbol, PERIOD_M15, 1, HISTORY_M15, m15);
   const int count1h = CopyRates(_Symbol, PERIOD_H1, 1, HISTORY_H1, h1);
   return count15 >= 101 && count1h >= 21;
}

string MakeDailyKey()
{
   MqlDateTime date;
   TimeToStruct(TimeCurrent(), date);
   return StringFormat("RFXEA_%I64d_%04d%02d%02d", AccountInfoInteger(ACCOUNT_LOGIN), date.year, date.mon, date.day);
}

double DailyBaseline()
{
   if(!GlobalVariableCheck(dailyBaselineKey))
      GlobalVariableSet(dailyBaselineKey, AccountInfoDouble(ACCOUNT_EQUITY));
   return GlobalVariableGet(dailyBaselineKey);
}

bool DailyLossLimitReached()
{
   const double baseline = DailyBaseline();
   if(baseline <= 0.0)
      return true;
   const double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   const double lossPercent = (baseline - equity) * 100.0 / baseline;
   if(lossPercent >= InpMaxDailyLossPercent)
   {
      PrintFormat("RFX EA paused: daily equity drawdown %.2f%% reached the %.2f%% limit.", lossPercent, InpMaxDailyLossPercent);
      return true;
   }
   return false;
}

bool HasPositionForThisEa()
{
   for(int i = PositionsTotal() - 1; i >= 0; --i)
   {
      const ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(PositionGetString(POSITION_SYMBOL) == _Symbol
         && (ulong)PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
         return true;
   }
   return false;
}

double NormalizeToTick(const double price)
{
   const double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize <= 0.0)
      return 0.0;
   return NormalizeDouble(MathRound(price / tickSize) * tickSize, _Digits);
}

double NormalizeVolumeDown(const double volume)
{
   const double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   const double minimum = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   const double maximum = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   if(step <= 0.0 || minimum <= 0.0 || maximum <= 0.0)
      return 0.0;
   const double normalized = MathFloor((volume + 1e-12) / step) * step;
   if(normalized < minimum)
      return 0.0;
   return NormalizeDouble(MathMin(normalized, maximum), 8);
}

double CalculateRiskVolume(const ENUM_ORDER_TYPE orderType, const double entry, const double stopLoss)
{
   double oneLotProfit = 0.0;
   if(!OrderCalcProfit(orderType, _Symbol, 1.0, entry, stopLoss, oneLotProfit) || oneLotProfit >= 0.0)
   {
      Print("RFX EA paused: could not calculate the stop-loss amount for one lot.");
      return 0.0;
   }

   const double riskMoney = AccountInfoDouble(ACCOUNT_EQUITY) * InpRiskPercent / 100.0;
   const double volume = NormalizeVolumeDown(riskMoney / MathAbs(oneLotProfit));
   if(volume <= 0.0)
   {
      Print("RFX EA skipped: minimum broker volume would exceed the configured risk.");
      return 0.0;
   }

   double estimatedLoss = 0.0;
   if(!OrderCalcProfit(orderType, _Symbol, volume, entry, stopLoss, estimatedLoss)
      || MathAbs(estimatedLoss) > riskMoney * 1.001)
   {
      Print("RFX EA paused: normalized volume exceeds the configured risk.");
      return 0.0;
   }
   return volume;
}

void EvaluateClosedCandle()
{
   if(AccountInfoInteger(ACCOUNT_TRADE_MODE) != ACCOUNT_TRADE_MODE_DEMO)
   {
      Print("RFX EA stopped: this EA is restricted to MT5 demo accounts.");
      return;
   }
   if(!InpEnableTrading)
   {
      Print("RFX EA signal check only: set InpEnableTrading=true to allow demo orders.");
      return;
   }
   if(DailyLossLimitReached() || HasPositionForThisEa())
      return;

   MqlRates m15[];
   MqlRates h1[];
   if(!ReadPriceHistory(m15, h1))
   {
      Print("RFX EA waiting: insufficient M15 or H1 history.");
      return;
   }

   const datetime candleCloseTime = m15[0].time + SIGNAL_PERIOD_MINUTES * 60;
   if(TimeCurrent() < candleCloseTime || TimeCurrent() - candleCloseTime > 2 * 60 * 60)
   {
      Print("RFX EA waiting: latest closed M15 candle is not current.");
      return;
   }

   const double closeNow = m15[0].close;
   const double closePrevious = m15[1].close;
   const double emaNow = EmaAt(m15, ArraySize(m15), 0, EMA_PERIOD);
   const double emaPrevious = EmaAt(m15, ArraySize(m15), 1, EMA_PERIOD);
   const double rsiNow = SimpleRsiAt(m15, ArraySize(m15), 0, RSI_PERIOD);
   const double atrNow = SimpleAtrAt(m15, ArraySize(m15), 0, ATR_PERIOD);
   const double hourlyClose = h1[0].close;
   const double hourlyEma = EmaAt(h1, ArraySize(h1), 0, EMA_PERIOD);
   if(emaNow == EMPTY_VALUE || emaPrevious == EMPTY_VALUE || rsiNow == EMPTY_VALUE
      || atrNow == EMPTY_VALUE || hourlyEma == EMPTY_VALUE || atrNow <= 0.0)
   {
      Print("RFX EA waiting: indicator history is incomplete.");
      return;
   }

   const bool buy = closePrevious <= emaPrevious && closeNow > emaNow
                    && rsiNow > 50.0 && hourlyClose > hourlyEma;
   const bool sell = closePrevious >= emaPrevious && closeNow < emaNow
                     && rsiNow < 50.0 && hourlyClose < hourlyEma;
   if(buy == sell)
   {
      PrintFormat("RFX EA WAIT %s: no unique closed-candle signal.", _Symbol);
      return;
   }

   const double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   const double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   const double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(ask <= 0.0 || bid <= 0.0 || point <= 0.0)
      return;
   const int spreadPoints = (int)MathRound((ask - bid) / point);
   if(InpMaxSpreadPoints > 0 && spreadPoints > InpMaxSpreadPoints)
   {
      PrintFormat("RFX EA skipped: spread %d points exceeds limit %d.", spreadPoints, InpMaxSpreadPoints);
      return;
   }

   const ENUM_ORDER_TYPE orderType = buy ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   const double entry = buy ? ask : bid;
   const double distance = atrNow * InpStopAtrMultiplier;
   const double stopLoss = NormalizeToTick(entry + (buy ? -distance : distance));
   const double takeProfit = NormalizeToTick(entry + (buy ? REWARD_RISK * distance : -REWARD_RISK * distance));
   if(stopLoss <= 0.0 || takeProfit <= 0.0 || (buy && (stopLoss >= bid || takeProfit <= ask))
      || (sell && (stopLoss <= ask || takeProfit >= bid)))
   {
      Print("RFX EA skipped: invalid stop-loss or take-profit side.");
      return;
   }

   const long stopsLevel = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   if(stopsLevel > 0 && (MathAbs(entry - stopLoss) < stopsLevel * point
      || MathAbs(entry - takeProfit) < stopsLevel * point))
   {
      Print("RFX EA skipped: SL/TP is inside the broker's minimum stop distance.");
      return;
   }

   const double volume = CalculateRiskVolume(orderType, entry, stopLoss);
   if(volume <= 0.0)
      return;

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.SetTypeFillingBySymbol(_Symbol);
   const string comment = buy ? "RFX demo BUY M15" : "RFX demo SELL M15";
   const bool sent = buy ? trade.Buy(volume, _Symbol, 0.0, stopLoss, takeProfit, comment)
                         : trade.Sell(volume, _Symbol, 0.0, stopLoss, takeProfit, comment);
   const uint retcode = trade.ResultRetcode();
   if(!sent || (retcode != TRADE_RETCODE_DONE && retcode != TRADE_RETCODE_DONE_PARTIAL
                && retcode != TRADE_RETCODE_PLACED))
   {
      PrintFormat("RFX demo order rejected: retcode %u · %s", retcode, trade.ResultRetcodeDescription());
      return;
   }

   PrintFormat("RFX demo %s sent: %s volume %.2f, SL %.*f, TP %.*f, risk %.2f%%.",
               buy ? "BUY" : "SELL", _Symbol, volume, _Digits, stopLoss, _Digits, takeProfit, InpRiskPercent);
}

int OnInit()
{
   if(!IsSupportedSymbol())
   {
      Print("RFX EA supports EURUSD, GBPUSD, USDJPY and XAUUSD symbols, including broker suffixes.");
      return INIT_FAILED;
   }
   if(Period() != PERIOD_M15)
   {
      Print("Attach RFX EA to an M15 chart.");
      return INIT_FAILED;
   }
   if(AccountInfoInteger(ACCOUNT_TRADE_MODE) != ACCOUNT_TRADE_MODE_DEMO)
   {
      Print("RFX EA is demo-only and will not initialize on a real or contest account.");
      return INIT_FAILED;
   }
   if(InpRiskPercent <= 0.0 || InpRiskPercent > 1.0
      || InpStopAtrMultiplier < 0.5 || InpStopAtrMultiplier > 5.0
      || InpMaxDailyLossPercent <= 0.0 || InpMaxDailyLossPercent > 3.0
      || InpMaxSpreadPoints < 0 || InpDeviationPoints < 0)
   {
      Print("Invalid risk input. Risk must be <=1%, ATR 0.5-5, and daily loss <=3%.");
      return INIT_PARAMETERS_INCORRECT;
   }

   dailyBaselineKey = MakeDailyKey();
   DailyBaseline();
   lastBarTime = iTime(_Symbol, PERIOD_M15, 0);
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.SetTypeFillingBySymbol(_Symbol);
   PrintFormat("RFX Forex demo EA ready on %s. Trading %s; risk %.2f%%; daily stop %.2f%%.",
               _Symbol, InpEnableTrading ? "enabled" : "disabled", InpRiskPercent, InpMaxDailyLossPercent);
   return INIT_SUCCEEDED;
}

void OnTick()
{
   if(AccountInfoInteger(ACCOUNT_TRADE_MODE) != ACCOUNT_TRADE_MODE_DEMO)
      return;
   const datetime currentBar = iTime(_Symbol, PERIOD_M15, 0);
   if(currentBar <= 0 || currentBar == lastBarTime)
      return;
   lastBarTime = currentBar;
   EvaluateClosedCandle();
}
