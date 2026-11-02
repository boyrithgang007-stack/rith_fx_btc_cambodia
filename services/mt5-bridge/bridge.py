"""Local, serialized MT5 investor-account and closed-candle reader. Never submits orders."""
import hmac
import json
import os
import re
from http.server import BaseHTTPRequestHandler, HTTPServer

import MetaTrader5 as mt5

TOKEN = os.environ.get("MT5_BRIDGE_TOKEN", "")
if len(TOKEN) < 32:
    raise RuntimeError("Set MT5_BRIDGE_TOKEN to at least 32 characters before starting.")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass  # Never log request headers, bodies, credentials or account data.

    def reply(self, status, body):
        payload = json.dumps(body, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        if self.path not in ("/account", "/candles"):
            return self.reply(404, {"error": "Not found"})
        if not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + TOKEN):
            return self.reply(401, {"error": "Unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 8192:
                return self.reply(400, {"error": "Invalid body"})
            body = json.loads(self.rfile.read(length))
            login, password, server = body["login"], body["password"], body["server"]
            if not isinstance(login, str) or not re.fullmatch(r"\d{1,15}", login) or int(login) <= 0:
                return self.reply(400, {"error": "Invalid login"})
            if not isinstance(password, str) or not 1 <= len(password) <= 256 or not isinstance(server, str) or not re.fullmatch(r"Exness[A-Za-z0-9 ._-]{1,100}", server, re.I):
                return self.reply(400, {"error": "Invalid credentials"})
            args = [os.environ["MT5_TERMINAL_PATH"]] if os.environ.get("MT5_TERMINAL_PATH") else []
            if not mt5.initialize(*args, login=int(login), password=password, server=server, timeout=15000):
                return self.reply(502, {"error": "MT5 login failed"})
            info = mt5.account_info()
            if info is None or info.login != int(login) or info.server != server:
                return self.reply(502, {"error": "Account identity mismatch"})
            if self.path == "/account" and info.trade_allowed:
                return self.reply(403, {"error": "Use the investor password with no trading permission"})
            if self.path == "/account":
                return self.reply(200, {"login": str(info.login), "server": info.server, "currency": info.currency, "balance": str(info.balance), "equity": str(info.equity), "margin": str(info.margin), "freeMargin": str(info.margin_free)})
            if info.trade_allowed:
                return self.reply(403, {"error": "Use the investor password for Forex signal data"})
            symbol = body.get("symbol")
            count = body.get("count", 500)
            if symbol not in ("EURUSD", "GBPUSD", "USDJPY", "XAUUSD") or not isinstance(count, int) or isinstance(count, bool) or not 100 <= count <= 1000:
                return self.reply(400, {"error": "Invalid Forex symbol or candle count"})
            available = mt5.symbols_get()
            candidates = [item.name for item in (available or ()) if item.name.upper() == symbol or re.fullmatch(re.escape(symbol) + r"[._-]?[A-Z0-9]{0,6}", item.name.upper())]
            if len(candidates) != 1:
                return self.reply(409, {"error": "MT5 symbol is missing or ambiguous; configure the exact broker symbol"})
            broker_symbol = candidates[0]
            if not mt5.symbol_select(broker_symbol, True):
                return self.reply(502, {"error": "MT5 could not select the Forex symbol"})
            rates = mt5.copy_rates_from_pos(broker_symbol, mt5.TIMEFRAME_M15, 1, count)
            if rates is None or len(rates) < 100:
                return self.reply(502, {"error": "MT5 returned insufficient closed 15m candles"})
            candles = [{
                "time": int(item["time"] + 900) * 1000,
                "open": float(item["open"]),
                "high": float(item["high"]),
                "low": float(item["low"]),
                "close": float(item["close"]),
                "volume": float(item["tick_volume"]),
            } for item in rates]
            return self.reply(200, {"symbol": symbol, "brokerSymbol": broker_symbol, "timeframe": "15m", "candles": candles})
        except Exception as error:
            print("[mt5-bridge] Request failed: " + type(error).__name__)
            return self.reply(502, {"error": "Account read failed"})
        finally:
            mt5.shutdown()


if __name__ == "__main__":
    # Single-threaded: the terminal has one current account; prevents cross-account races.
    HTTPServer(("127.0.0.1", 8787), Handler).serve_forever()
