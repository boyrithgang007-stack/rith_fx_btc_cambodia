import http.client
import importlib.util
import json
import os
import pathlib
import sys
import threading
import time
import types
import unittest
from http.server import HTTPServer


class FakeMetaTrader:
    TIMEFRAME_M15 = 15

    def __init__(self):
        self.allow_trading = False

    def initialize(self, *args, **kwargs):
        return True

    def account_info(self):
        return types.SimpleNamespace(login=12345, server="Exness-MT5Trial", trade_allowed=self.allow_trading)

    def symbols_get(self):
        return [types.SimpleNamespace(name="EURUSD"), types.SimpleNamespace(name="GBPUSDm")]

    def symbol_select(self, _symbol, _select):
        return True

    def copy_rates_from_pos(self, _symbol, _timeframe, _start, count):
        base = 1_700_000_000
        interval = 15 * 60
        return [
            {"time": base + i * interval, "open": 1.1, "high": 1.2, "low": 1.0, "close": 1.15, "tick_volume": 10}
            for i in range(count)
        ]

    def shutdown(self):
        pass


FAKE_MT5 = FakeMetaTrader()
sys.modules["MetaTrader5"] = FAKE_MT5
os.environ["MT5_BRIDGE_TOKEN"] = "t" * 40
BRIDGE_PATH = pathlib.Path(__file__).parents[1] / "services" / "mt5-bridge" / "bridge.py"
SPEC = importlib.util.spec_from_file_location("mt5_bridge_under_test", BRIDGE_PATH)
BRIDGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BRIDGE)


class BridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), BRIDGE.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.server.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.thread.join(timeout=2)
        cls.server.server_close()

    def request(self, path, body=None, token="t" * 40):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        payload = json.dumps(body or {})
        connection.request("POST", path, payload, {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
        })
        response = connection.getresponse()
        result = json.loads(response.read())
        connection.close()
        return response.status, result

    def valid_body(self, **overrides):
        return {"login": "12345", "password": "investor-password", "server": "Exness-MT5Trial", **overrides}

    def test_only_authenticated_local_routes_are_served(self):
        self.assertEqual(self.request("/candles", self.valid_body(), "wrong")[0], 401)
        self.assertEqual(self.request("/order", self.valid_body())[0], 404)

    def test_closed_candles_support_exact_and_unique_suffix_symbols(self):
        status, response = self.request("/candles", self.valid_body(symbol="EURUSD", count=100))
        self.assertEqual(status, 200)
        self.assertEqual(response["brokerSymbol"], "EURUSD")
        self.assertEqual(response["timeframe"], "15m")
        self.assertEqual(len(response["candles"]), 100)
        self.assertEqual(response["candles"][0]["time"], (1_700_000_000 + 900) * 1000)
        status, response = self.request("/candles", self.valid_body(symbol="GBPUSD", count=100))
        self.assertEqual(status, 200)
        self.assertEqual(response["brokerSymbol"], "GBPUSDm")

    def test_invalid_symbols_and_trade_enabled_sessions_fail_closed(self):
        self.assertEqual(self.request("/candles", self.valid_body(symbol="EURUSDm", count=100))[0], 400)
        self.assertEqual(self.request("/candles", self.valid_body(symbol="EURUSD", count=99))[0], 400)
        FAKE_MT5.allow_trading = True
        try:
            self.assertEqual(self.request("/candles", self.valid_body(symbol="EURUSD", count=100))[0], 403)
            self.assertEqual(self.request("/account", self.valid_body())[0], 403)
        finally:
            FAKE_MT5.allow_trading = False


if __name__ == "__main__":
    unittest.main()
