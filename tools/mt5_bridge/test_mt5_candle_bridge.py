import importlib.util
from datetime import datetime, timezone
from pathlib import Path
import sys
import types
import unittest


fake_mt5 = types.SimpleNamespace(TIMEFRAME_D1=1, TIMEFRAME_H4=2, TIMEFRAME_H1=3)
sys.modules.setdefault("MetaTrader5", fake_mt5)
module_path = Path(__file__).with_name("mt5_candle_bridge.py")
spec = importlib.util.spec_from_file_location("mt5_candle_bridge", module_path)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)
SYMBOLS = ["BTCUSD", "XAUUSD", "USDJPY", "US500", "US100"]


def ticks(skews):
    return [{
        "platform_symbol": symbol,
        "broker_symbol": symbol,
        "bid": 100.0,
        "ask": 101.0,
        "last": None,
        "raw_time": int(NOW.timestamp() + skew),
        "raw_time_msc": int((NOW.timestamp() + skew) * 1000),
        "raw_epoch_seconds": NOW.timestamp() + skew,
    } for symbol, skew in zip(SYMBOLS, skews)]


class BrokerClockNormalizationTests(unittest.TestCase):
    def test_detects_and_normalizes_dynamic_utc_plus_three(self):
        raw = ticks([10798, 10799, 10799, 10784, 10799])
        self.assertEqual(bridge.detect_broker_clock_offset(raw, NOW), 10800)
        normalized = bridge.normalize_collected_ticks(raw, NOW)
        self.assertTrue(all(abs(datetime.fromisoformat(item["tick_time"].replace("Z", "+00:00")).timestamp() - NOW.timestamp()) <= 16 for item in normalized))

    def test_detects_other_consistent_whole_hour_offset_dynamically(self):
        self.assertEqual(bridge.detect_broker_clock_offset(ticks([7198, 7200, 7201, 7199, 7200]), NOW), 7200)
        self.assertEqual(bridge.detect_broker_clock_offset(ticks([10798, 10800, 10801, 10799, 10800]), NOW), 10800)

    def test_normal_utc_feed_applies_no_offset(self):
        self.assertEqual(bridge.detect_broker_clock_offset(ticks([-2, 0, 1, -1, 2]), NOW), 0)

    def test_inconsistent_offsets_are_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "disagree"):
            bridge.detect_broker_clock_offset(ticks([10800, 10800, 10800, 7200, 7200]), NOW)

    def test_fewer_than_three_agreeing_symbols_are_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "requires 3 symbols"):
            bridge.detect_broker_clock_offset(ticks([10800, 10800, 7200, 7200, 14400]), NOW)

    def test_non_whole_hour_offset_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "whole-hour"):
            bridge.detect_broker_clock_offset(ticks([9000] * 5), NOW)

    def test_offset_outside_safe_range_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "safe"):
            bridge.detect_broker_clock_offset(ticks([54000] * 5), NOW)

    def test_normalized_future_timestamp_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "ahead"):
            bridge.normalize_collected_ticks(ticks([10800, 10800, 10800, 10800, 10861]), NOW)

    def test_old_market_closed_tick_remains_old(self):
        normalized = bridge.normalize_collected_ticks(ticks([10800, 10800, 10800, 10800, -86400 + 10800]), NOW)
        old = datetime.fromisoformat(normalized[-1]["tick_time"].replace("Z", "+00:00"))
        self.assertEqual((NOW - old).total_seconds(), 86400)


if __name__ == "__main__":
    unittest.main()
