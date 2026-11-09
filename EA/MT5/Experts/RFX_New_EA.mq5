#property strict
#property version   "1.00"
#property description "Starter template for a new RFX MT5 Expert Advisor. No orders are sent."

#include <Trade/Trade.mqh>

input bool InpEnableTrading = false; // Keep disabled until strategy and risk controls are reviewed.
input ulong InpMagicNumber = 20261107;

CTrade Trade;

int OnInit()
  {
   Trade.SetExpertMagicNumber(InpMagicNumber);
   Print("RFX new EA template initialized. Trading is disabled by default.");
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   PrintFormat("RFX new EA template stopped. Reason: %d", reason);
  }

void OnTick()
  {
   // Add closed-candle signal logic here.
   // Validate spread, position limits, sizing, stop loss, take profit,
   // and daily loss limits before adding any order logic.
   if(!InpEnableTrading)
      return;

   // Trading remains intentionally unimplemented in this starter template.
  }
