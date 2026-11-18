"""Unit and end-to-end API tests for SoSoValue One-Person On-Chain Finance Desk."""

from __future__ import annotations

import json
import sys
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.engine import OnePersonFinanceDesk, RiskPolicy, analyze_opportunity, DEFAULT_SSI_BASKETS
from backend.server import create_server


class TestSoSoValueDesk(unittest.TestCase):
    """Tests SSI signal generation, risk control gates, and confirmation workflow."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.srv = create_server(port=0)
        cls.port = cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.srv.shutdown()
        cls.srv.server_close()

    def test_analyze_opportunity_regimes(self) -> None:
        mag7 = DEFAULT_SSI_BASKETS[0]
        meme = DEFAULT_SSI_BASKETS[2]
        sig_mag7 = analyze_opportunity(mag7, capital_usdc=6000.0)
        sig_meme = analyze_opportunity(meme, capital_usdc=6000.0)

        self.assertEqual(sig_mag7.direction, "LONG")
        self.assertGreaterEqual(sig_mag7.confidence, 0.8)
        self.assertEqual(sig_meme.direction, "DELTA_NEUTRAL_HEDGE")
        self.assertIn("funding", sig_meme.thesis.lower())

    def test_risk_gate_blocks_oversized_and_drawdown(self) -> None:
        desk = OnePersonFinanceDesk(policy=RiskPolicy(max_order_usdc=1000.0, max_daily_drawdown_pct=3.0))
        scan = desk.scan_market()
        sig_id = scan["signals"][0]["signal_id"]

        # Oversized order should be rejected by risk gate.
        rejected = desk.stage_order(signal_id=sig_id, notional_usdc=1800.0)
        self.assertFalse(rejected.risk_passed)
        self.assertEqual(rejected.status, "REJECTED_BY_RISK")
        with self.assertRaises(ValueError):
            desk.confirm_order(rejected.ticket_id, action="APPROVE")

        # Drawdown circuit breaker should also reject.
        dd_rejected = desk.stage_order(signal_id=sig_id, notional_usdc=500.0, current_drawdown_pct=3.5)
        self.assertFalse(dd_rejected.risk_passed)

    def test_http_end_to_end_scan_stage_and_confirm(self) -> None:
        with urllib.request.urlopen(f"http://127.0.0.1:{self.port}/api/scan", timeout=5) as r:
            scan = json.loads(r.read().decode("utf-8"))
        self.assertEqual(len(scan["baskets"]), 4)
        top_sig = scan["signals"][0]

        stage_req = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/api/stage",
            data=json.dumps({"signalId": top_sig["signal_id"], "notionalUsdc": 900.0, "slippageBps": 20}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(stage_req, timeout=5) as r2:
            ticket = json.loads(r2.read().decode("utf-8"))
        self.assertEqual(ticket["status"], "PENDING_CONFIRMATION")
        self.assertTrue(ticket["risk_passed"])

        confirm_req = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/api/confirm",
            data=json.dumps({"ticketId": ticket["ticket_id"], "action": "APPROVE"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(confirm_req, timeout=5) as r3:
            confirmed = json.loads(r3.read().decode("utf-8"))
        self.assertEqual(confirmed["status"], "CONFIRMED_DISPATCHED")
        self.assertIsNotNone(confirmed["execution_receipt"]["orderHash"])


if __name__ == "__main__":
    unittest.main()
