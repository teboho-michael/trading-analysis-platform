import importlib.util
from datetime import datetime, timezone
from pathlib import Path
import sys
import types
import unittest
import tempfile
from unittest import mock


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

    def test_candle_utc_plus_three_normalizes_once(self):
        raw = NOW.timestamp() + 10800
        normalized = bridge.normalize_candle_timestamp(raw, 10800, NOW)
        self.assertEqual(normalized, "2026-01-01T00:00:00Z")
        self.assertEqual(bridge.normalize_candle_timestamp(NOW.timestamp(), 0, NOW), normalized)

    def test_candle_boundaries_remain_exact(self):
        for hour in (0, 4, 8, 12):
            moment = datetime(2026, 1, 1, hour, tzinfo=timezone.utc)
            normalized = datetime.fromisoformat(bridge.normalize_candle_timestamp(moment.timestamp() + 10800, 10800, moment).replace("Z", "+00:00"))
            self.assertEqual((normalized.minute, normalized.second), (0, 0))
            self.assertEqual(normalized.hour, hour)

    def test_future_candle_rejected_and_old_retained(self):
        with self.assertRaisesRegex(RuntimeError, "future"):
            bridge.normalize_candle_timestamp(NOW.timestamp() + 61, 0, NOW)
        old = bridge.normalize_candle_timestamp(NOW.timestamp() - 86400, 0, NOW)
        self.assertEqual(old, "2025-12-31T00:00:00Z")

    def test_incremental_limit_uses_small_overlap(self):
        original = bridge.api_json
        bridge.api_json = lambda _path: {"latest_closed_candle_time": "2025-12-31T23:00:00Z"}
        original_now = bridge.datetime
        try:
            class FixedDateTime(datetime):
                @classmethod
                def now(cls, tz=None): return NOW
            bridge.datetime = FixedDateTime
            self.assertEqual(bridge.incremental_limit("BTCUSD", "H1"), 4)
        finally:
            bridge.api_json = original
            bridge.datetime = original_now

    def test_active_continuous_lock_pid_is_rejected_without_deleting_lock(self):
        original = bridge.CONTINUOUS_LOCK_FILE
        try:
            bridge.CONTINUOUS_LOCK_FILE = Path(tempfile.gettempdir()) / "tap-test-continuous.lock"
            bridge.CONTINUOUS_LOCK_FILE.write_text(str(__import__("os").getpid()), encoding="utf-8")
            with mock.patch.object(bridge, "is_process_alive", return_value=True):
                with self.assertRaisesRegex(RuntimeError, "already running"):
                    with bridge.ContinuousLock(): pass
            self.assertTrue(bridge.CONTINUOUS_LOCK_FILE.exists())
        finally:
            bridge.CONTINUOUS_LOCK_FILE.unlink(missing_ok=True)
            bridge.CONTINUOUS_LOCK_FILE = original

    def test_stale_continuous_lock_pid_is_replaced(self):
        original = bridge.CONTINUOUS_LOCK_FILE
        try:
            bridge.CONTINUOUS_LOCK_FILE = Path(tempfile.gettempdir()) / "tap-test-continuous.lock"
            bridge.CONTINUOUS_LOCK_FILE.write_text("999999", encoding="utf-8")
            with mock.patch.object(bridge, "is_process_alive", return_value=False):
                with bridge.ContinuousLock():
                    self.assertEqual(bridge.CONTINUOUS_LOCK_FILE.read_text(encoding="utf-8"), str(__import__("os").getpid()))
            self.assertFalse(bridge.CONTINUOUS_LOCK_FILE.exists())
        finally:
            bridge.CONTINUOUS_LOCK_FILE.unlink(missing_ok=True)
            bridge.CONTINUOUS_LOCK_FILE = original

    def test_malformed_continuous_lock_is_replaced(self):
        original = bridge.CONTINUOUS_LOCK_FILE
        try:
            bridge.CONTINUOUS_LOCK_FILE = Path(tempfile.gettempdir()) / "tap-test-continuous.lock"
            bridge.CONTINUOUS_LOCK_FILE.write_text("", encoding="utf-8")
            with mock.patch.object(bridge, "is_process_alive") as is_alive:
                with bridge.ContinuousLock():
                    self.assertEqual(bridge.CONTINUOUS_LOCK_FILE.read_text(encoding="utf-8"), str(__import__("os").getpid()))
                is_alive.assert_not_called()
            self.assertFalse(bridge.CONTINUOUS_LOCK_FILE.exists())
        finally:
            bridge.CONTINUOUS_LOCK_FILE.unlink(missing_ok=True)
            bridge.CONTINUOUS_LOCK_FILE = original

    def test_replaced_lock_is_not_deleted_during_stale_cleanup(self):
        original = bridge.CONTINUOUS_LOCK_FILE
        replacement_pid = __import__("os").getpid()
        try:
            bridge.CONTINUOUS_LOCK_FILE = Path(tempfile.gettempdir()) / "tap-test-continuous.lock"
            bridge.CONTINUOUS_LOCK_FILE.write_text("999999", encoding="utf-8")

            def replace_stale_lock(pid):
                if pid == 999999:
                    bridge.CONTINUOUS_LOCK_FILE.unlink()
                    bridge.CONTINUOUS_LOCK_FILE.write_text(str(replacement_pid), encoding="utf-8")
                    return False
                return True

            with mock.patch.object(bridge, "is_process_alive", side_effect=replace_stale_lock):
                with self.assertRaisesRegex(RuntimeError, f"already running with PID {replacement_pid}"):
                    with bridge.ContinuousLock(): pass
            self.assertEqual(bridge.CONTINUOUS_LOCK_FILE.read_text(encoding="utf-8"), str(replacement_pid))
        finally:
            bridge.CONTINUOUS_LOCK_FILE.unlink(missing_ok=True)
            bridge.CONTINUOUS_LOCK_FILE = original

    def test_windows_mutex_acquisition_succeeds_despite_stale_informational_lock(self):
        original = bridge.CONTINUOUS_LOCK_FILE
        kernel32 = types.SimpleNamespace(
            CreateMutexW=mock.Mock(return_value=123),
            ReleaseMutex=mock.Mock(return_value=True),
            CloseHandle=mock.Mock(return_value=True),
        )
        lock = bridge.ContinuousLock()
        try:
            bridge.CONTINUOUS_LOCK_FILE = Path(tempfile.gettempdir()) / "tap-test-continuous.lock"
            bridge.CONTINUOUS_LOCK_FILE.write_text("999999", encoding="utf-8")
            lock._enter_windows(kernel32=kernel32, get_last_error=lambda: 0)
            self.assertEqual(bridge.CONTINUOUS_LOCK_FILE.read_text(encoding="utf-8"), str(__import__("os").getpid()))
            kernel32.CreateMutexW.assert_called_once_with(None, True, bridge.WINDOWS_MUTEX_NAME)
        finally:
            if hasattr(lock, "_windows_mutex_handle"):
                lock.__exit__(None, None, None)
            bridge.CONTINUOUS_LOCK_FILE.unlink(missing_ok=True)
            bridge.CONTINUOUS_LOCK_FILE = original

    def test_windows_mutex_already_exists_is_rejected(self):
        kernel32 = types.SimpleNamespace(
            CreateMutexW=mock.Mock(return_value=456),
            ReleaseMutex=mock.Mock(return_value=True),
            CloseHandle=mock.Mock(return_value=True),
        )
        with self.assertRaisesRegex(RuntimeError, "Windows mutex exists"):
            bridge.ContinuousLock()._enter_windows(kernel32=kernel32, get_last_error=lambda: 183)
        kernel32.ReleaseMutex.assert_not_called()
        kernel32.CloseHandle.assert_called_once_with(456)

    def test_windows_mutex_handle_is_released_and_closed_on_exit(self):
        original = bridge.CONTINUOUS_LOCK_FILE
        kernel32 = types.SimpleNamespace(
            CreateMutexW=mock.Mock(return_value=789),
            ReleaseMutex=mock.Mock(return_value=True),
            CloseHandle=mock.Mock(return_value=True),
        )
        lock = bridge.ContinuousLock()
        try:
            bridge.CONTINUOUS_LOCK_FILE = Path(tempfile.gettempdir()) / "tap-test-continuous.lock"
            lock._enter_windows(kernel32=kernel32, get_last_error=lambda: 0)
            lock.__exit__(None, None, None)
            kernel32.ReleaseMutex.assert_called_once_with(789)
            kernel32.CloseHandle.assert_called_once_with(789)
            self.assertFalse(bridge.CONTINUOUS_LOCK_FILE.exists())
        finally:
            bridge.CONTINUOUS_LOCK_FILE.unlink(missing_ok=True)
            bridge.CONTINUOUS_LOCK_FILE = original

    def test_windows_liveness_check_queries_exit_code_and_closes_handle(self):
        kernel32 = types.SimpleNamespace(
            OpenProcess=mock.Mock(return_value=123),
            GetExitCodeProcess=mock.Mock(side_effect=lambda _handle, exit_code: setattr(exit_code._obj, "value", 259) or True),
            CloseHandle=mock.Mock(return_value=True),
        )
        self.assertTrue(bridge._is_windows_process_alive(321, kernel32=kernel32))
        kernel32.OpenProcess.assert_called_once_with(0x1000, False, 321)
        kernel32.GetExitCodeProcess.assert_called_once()
        kernel32.CloseHandle.assert_called_once_with(123)


if __name__ == "__main__":
    unittest.main()
