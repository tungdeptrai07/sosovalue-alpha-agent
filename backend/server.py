"""HTTP API and static web server for SoSoValue One-Person Finance Desk (port 8091)."""

from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = BASE_DIR / "web"

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from backend.engine import OnePersonFinanceDesk, RiskPolicy, SoSoValueClient


class DeskHTTPHandler(SimpleHTTPRequestHandler):
    """Serves the SoSoValue & SoDEX One-Person Desk UI and JSON endpoints."""

    desk = OnePersonFinanceDesk()

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def log_message(self, format: str, *args) -> None:
        return

    def _send_json(self, payload: dict, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self._send_json(
                {
                    "status": "ok",
                    "service": "SoSoValue One-Person On-Chain Finance Desk",
                    "exposureUsdc": self.desk.current_exposure_usdc,
                }
            )
            return

        if self.path.startswith("/api/scan"):
            self._send_json(self.desk.scan_market())
            return

        if self.path == "/api/tickets":
            self._send_json({"tickets": [asdict(t) for t in self.desk.tickets.values()]})
            return

        if self.path in {"", "/"}:
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(min(length, 128_000))
            data = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            self._send_json({"error": "Invalid JSON body"}, status=HTTPStatus.BAD_REQUEST)
            return

        try:
            if self.path == "/api/stage":
                signal_id = str(data.get("signalId", "")).strip()
                notional = data.get("notionalUsdc")
                slippage = int(data.get("slippageBps", 25))
                drawdown = float(data.get("drawdownPct", 0.0))
                tkt = self.desk.stage_order(
                    signal_id=signal_id,
                    notional_usdc=float(notional) if notional is not None else None,
                    slippage_bps=slippage,
                    current_drawdown_pct=drawdown,
                )
                self._send_json(asdict(tkt))
                return

            if self.path == "/api/confirm":
                ticket_id = str(data.get("ticketId", "")).strip()
                action = str(data.get("action", "APPROVE")).strip()
                tkt = self.desk.confirm_order(ticket_id=ticket_id, action=action)
                self._send_json(asdict(tkt))
                return
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        self._send_json({"error": "Endpoint not found"}, status=HTTPStatus.NOT_FOUND)


def create_server(
    host: str = "127.0.0.1",
    port: int = 8091,
    desk: OnePersonFinanceDesk | None = None,
) -> ThreadingHTTPServer:
    """Create and return the configured HTTP server."""

    class BoundHandler(DeskHTTPHandler):
        pass

    BoundHandler.desk = desk or OnePersonFinanceDesk()
    return ThreadingHTTPServer((host, port), BoundHandler)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8091"))
    srv = create_server(port=port)
    print(f"SoSoValue One-Person Finance Desk running on http://127.0.0.1:{port}", flush=True)
    srv.serve_forever()
