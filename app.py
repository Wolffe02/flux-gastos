#!/usr/bin/env python3
"""Local Debian app and read-only Enable Banking connector for CaixaBank."""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import html
import json
import mimetypes
import os
import re
import secrets
import shutil
import sqlite3
import subprocess
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST, PORT = "127.0.0.1", 8765
CONFIG_BASE = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
DATA_BASE = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share"))
CONFIG_DIR = CONFIG_BASE / ("claro-gastos" if not (CONFIG_BASE / "flux-gastos").exists() and (CONFIG_BASE / "claro-gastos").exists() else "flux-gastos")
DATA_DIR = DATA_BASE / ("claro-gastos" if not (DATA_BASE / "flux-gastos").exists() and (DATA_BASE / "claro-gastos").exists() else "flux-gastos")
CONFIG_FILE = CONFIG_DIR / "config.json"
DB_FILE = DATA_DIR / "gastos.sqlite3"
API = "https://api.enablebanking.com"
LOCK = threading.Lock()
PENDING_STATE: str | None = None


def db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, accounts TEXT NOT NULL, expires TEXT)")
    conn.execute("CREATE TABLE IF NOT EXISTS transactions (key TEXT PRIMARY KEY, account TEXT, date TEXT, description TEXT, amount REAL, currency TEXT, pending INTEGER DEFAULT 0)")
    return conn


def config():
    try:
        value = json.loads(CONFIG_FILE.read_text())
        key_path = Path(value["private_key_path"]).expanduser().resolve()
        if not key_path.is_file():
            return None
        return {"application_id": value["application_id"], "private_key_path": str(key_path)}
    except (OSError, ValueError, KeyError, TypeError):
        return None


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def jwt_token(cfg):
    now = int(dt.datetime.now(dt.timezone.utc).timestamp())
    header = b64(json.dumps({"typ": "JWT", "alg": "RS256", "kid": cfg["application_id"]}, separators=(",", ":")).encode())
    payload = b64(json.dumps({"iss": "enablebanking.com", "aud": "api.enablebanking.com", "iat": now, "exp": now + 300}, separators=(",", ":")).encode())
    signing = f"{header}.{payload}".encode()
    proc = subprocess.run(["openssl", "dgst", "-sha256", "-sign", cfg["private_key_path"]], input=signing, capture_output=True, check=True)
    return f"{header}.{payload}.{b64(proc.stdout)}"


def api(method, path, body=None, query=None):
    cfg = config()
    if not cfg:
        raise RuntimeError("Falta la configuración de Enable Banking. Consulta README.md.")
    url = API + path
    if query:
        url += "?" + urllib.parse.urlencode(query)
    payload = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=payload, method=method, headers={"Authorization": "Bearer " + jwt_token(cfg), "Accept": "application/json", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:600]
        raise RuntimeError(f"Enable Banking respondió {exc.code}: {detail}") from exc


def recurring_category(description):
    s = description.casefold()
    if any(k in s for k in ("netflix", "spotify", "disney", "hbo", "prime video", "icloud", "apple.com/bill", "youtube premium", "google one", "adobe", "openai", "subscription")):
        return "Suscripciones"
    if any(k in s for k in ("electric", "luz", "endesa", "iberdrola", "naturgy", "agua", "canal isabel", "movistar", "vodafone", "orange", "masmovil", "internet", "gas natural")):
        return "Recibos"
    return "Recurrentes"


def to_transactions(account_id, response):
    txns = response.get("transactions", [])
    # Providers may wrap booked and pending transactions separately.
    if not txns:
        txns = response.get("booked", []) + response.get("pending", [])
    result = []
    for t in txns:
        amount = t.get("transaction_amount") or t.get("amount") or {}
        raw_amount = amount.get("amount") if isinstance(amount, dict) else amount
        if raw_amount is None:
            continue
        desc = t.get("remittance_information") or t.get("creditor_name") or t.get("debtor_name") or t.get("additional_information") or t.get("transaction_id") or "Movimiento bancario"
        if isinstance(desc, list):
            desc = " · ".join(map(str, desc))
        date = t.get("booking_date") or t.get("transaction_date") or t.get("value_date") or dt.date.today().isoformat()
        ident = str(t.get("transaction_id") or t.get("entry_reference") or hashlib.sha256(json.dumps(t, sort_keys=True).encode()).hexdigest())
        value = float(raw_amount)
        direction = str(t.get("credit_debit_indicator", "")).upper()
        if value > 0 and direction == "DBIT": value = -value
        elif value < 0 and direction == "CRDT": value = abs(value)
        result.append({"key": hashlib.sha256(f"{account_id}:{ident}".encode()).hexdigest(), "account": account_id, "date": str(date)[:10], "description": str(desc)[:240], "amount": value, "currency": amount.get("currency", "EUR") if isinstance(amount, dict) else "EUR", "pending": int(t.get("transaction_status") == "PDNG")})
    return result


def import_transactions(session):
    conn = db()
    count = 0
    for account in session.get("accounts", []):
        if isinstance(account, str):
            account_id, label = account, account
        else:
            account_id = account.get("uid") or account.get("account_id") or account.get("resource_id")
            label = account.get("name") or account.get("account_name") or account_id
        if not account_id:
            continue
        from_date = (dt.date.today() - dt.timedelta(days=180)).isoformat()
        page = api("GET", f"/accounts/{urllib.parse.quote(str(account_id), safe='')}/transactions", query={"date_from": from_date, "transaction_status": "BOOK"})
        for item in to_transactions(str(account_id), page):
            conn.execute("INSERT OR REPLACE INTO transactions(key,account,date,description,amount,currency,pending) VALUES(:key,:account,:date,:description,:amount,:currency,:pending)", item)
            count += 1
    conn.execute("INSERT OR REPLACE INTO sessions(id, accounts, expires) VALUES(?,?,?)", (session["session_id"], json.dumps(session.get("accounts_data", session.get("accounts", []))), (session.get("access") or {}).get("valid_until")))
    conn.commit()
    conn.close()
    return count


def recurring_summary():
    conn = db()
    rows = conn.execute("SELECT * FROM transactions WHERE amount < 0 ORDER BY date DESC").fetchall()
    conn.close()
    # A payment is treated as recurring when a normalized merchant occurs twice
    # within the available six-month history.
    groups = {}
    for row in rows:
        desc = row["description"].strip()
        name = re.sub(r"\b(?:\d{2}[/-]){1,2}\d{2,4}\b|\b\d{5,}\b", " ", desc.upper())
        name = " ".join(name.split())[:70]
        groups.setdefault(name, []).append(row)
    out = []
    for name, items in groups.items():
        if len(items) < 2:
            continue
        amounts = [abs(float(x["amount"])) for x in items]
        mean = sum(amounts) / len(amounts)
        if max(amounts) > mean * 1.25:
            continue
        latest = dt.date.fromisoformat(items[0]["date"])
        out.append({"name": name, "amount": round(mean, 2), "type": recurring_category(name), "date": latest.day, "icon": "↻", "merchant": name, "occurrences": len(items), "lastDate": latest.isoformat()})
    return out


def monthly_totals():
    conn = db()
    rows = conn.execute("SELECT date,description,amount FROM transactions WHERE amount < 0").fetchall()
    conn.close()
    today = dt.date.today().replace(day=1)
    months = []
    for offset in range(5, -1, -1):
        y, m = today.year, today.month - offset
        while m <= 0:
            y -= 1; m += 12
        key = f"{y:04d}-{m:02d}"
        sums = {"total": 0.0, "Suscripciones": 0.0, "Recibos": 0.0, "Recurrentes": 0.0}
        for row in rows:
            if str(row["date"]).startswith(key):
                amount = abs(float(row["amount"]))
                sums["total"] += amount
                sums[recurring_category(row["description"])] += amount
        months.append({"month": key, **{k: round(v, 2) for k, v in sums.items()}})
    return months


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # never write callback parameters or transaction data to the console

    def send_json(self, status, value):
        payload = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def read_json(self):
        length = min(int(self.headers.get("Content-Length", "0")), 20000)
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self):
        global PENDING_STATE
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/status":
            conn = db()
            session = conn.execute("SELECT id,expires FROM sessions ORDER BY rowid DESC LIMIT 1").fetchone()
            txn_count = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
            conn.close()
            return self.send_json(200, {"configured": config() is not None, "connected": session is not None, "expires": session["expires"] if session else None, "transactionCount": txn_count})
        if parsed.path == "/api/recurring":
            return self.send_json(200, {"items": recurring_summary()})
        if parsed.path == "/api/monthly":
            return self.send_json(200, {"items": monthly_totals()})
        if parsed.path == "/api/transactions":
            conn = db()
            rows = [dict(r) for r in conn.execute("SELECT * FROM transactions ORDER BY date DESC LIMIT 1000")]
            conn.close()
            return self.send_json(200, {"items": rows})
        if parsed.path == "/callback":
            params = urllib.parse.parse_qs(parsed.query)
            code = params.get("code", [None])[0]
            state = params.get("state", [None])[0]
            error = params.get("error_description", params.get("error", [None]))[0]
            with LOCK:
                expected = PENDING_STATE
                PENDING_STATE = None
            if error or not code or not expected or not secrets.compare_digest(state or "", expected):
                message = "La autorización se canceló o no coincidió el estado. Puedes volver a intentarlo desde la aplicación."
                if error:
                    message = "CaixaBank no completó la autorización. Vuelve a intentarlo desde la aplicación."
                return self.page_response("Conexión no completada", message)
            try:
                session = api("POST", "/sessions", {"code": code})
                n = import_transactions(session)
                return self.page_response("CaixaBank conectado", f"Autorización completada. Se han importado {n} movimientos. Ya puedes volver a Flux.")
            except Exception as exc:
                return self.page_response("No se pudieron importar los movimientos", str(exc))
        path = "/index.html" if parsed.path == "/" else parsed.path
        target = (ROOT / path.lstrip("/")).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file():
            self.send_error(404)
            return
        content = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(str(target))[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def page_response(self, title, text):
        payload = f"<!doctype html><html lang='es'><meta charset='utf-8'><meta name='viewport' content='width=device-width'><title>{html.escape(title)}</title><body style='font:16px system-ui;max-width:650px;margin:12vh auto;padding:24px;color:#17231f'><h1>{html.escape(title)}</h1><p>{html.escape(text)}</p><p>Puedes cerrar esta pestaña y volver a Flux.</p></body></html>".encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        global PENDING_STATE
        origin = self.headers.get("Origin")
        if origin and origin != f"http://{HOST}:{PORT}":
            return self.send_json(403, {"error": "Origen de solicitud no permitido."})
        if self.path == "/api/connect":
            try:
                state = secrets.token_urlsafe(32)
                valid_until = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=80)).replace(microsecond=0).isoformat()
                aspsps = api("GET", "/aspsps", query={"country": "ES", "service": "AIS", "psu_type": "personal"})
                items = aspsps if isinstance(aspsps, list) else aspsps.get("aspsps", [])
                bank = next((a for a in items if "caixabank" in str(a.get("name", "")).casefold()), None)
                if not bank:
                    return self.send_json(404, {"error": "Enable Banking no ofrece CaixaBank en su lista actual de conexiones para cuentas personales."})
                body = {"access": {"valid_until": valid_until, "transactions": True}, "aspsp": {"name": bank["name"], "country": "ES"}, "state": state, "redirect_url": f"http://{HOST}:{PORT}/callback", "psu_type": "personal", "language": "es"}
                result = api("POST", "/auth", body)
                with LOCK:
                    PENDING_STATE = state
                return self.send_json(200, {"url": result["url"]})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})
        if self.path == "/api/sync":
            conn = db()
            row = conn.execute("SELECT id,accounts,expires FROM sessions ORDER BY rowid DESC LIMIT 1").fetchone()
            conn.close()
            if not row:
                return self.send_json(400, {"error": "Primero conecta CaixaBank."})
            try:
                accounts_data = json.loads(row["accounts"])
                ids = []
                for x in accounts_data:
                    if isinstance(x, str): ids.append(x)
                    elif x.get("uid"): ids.append(x["uid"])
                    elif x.get("account_id"): ids.append(x["account_id"])
                n = 0
                for aid in ids:
                    from_date = (dt.date.today() - dt.timedelta(days=180)).isoformat()
                    page = api("GET", f"/accounts/{urllib.parse.quote(aid, safe='')}/transactions", query={"date_from": from_date, "transaction_status": "BOOK"})
                    for item in to_transactions(aid, page):
                        conn = db()
                        conn.execute("INSERT OR REPLACE INTO transactions(key,account,date,description,amount,currency,pending) VALUES(:key,:account,:date,:description,:amount,:currency,:pending)", item)
                        conn.commit(); conn.close(); n += 1
                return self.send_json(200, {"count": n})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})
        if self.path == "/api/disconnect":
            conn = db()
            row = conn.execute("SELECT id FROM sessions ORDER BY rowid DESC LIMIT 1").fetchone()
            conn.close()
            if row:
                try:
                    api("DELETE", f"/sessions/{urllib.parse.quote(row['id'], safe='')}")
                except Exception as exc:
                    return self.send_json(400, {"error": f"No se revocó el consentimiento bancario: {exc}"})
            conn = db()
            conn.execute("DELETE FROM sessions")
            conn.execute("DELETE FROM transactions")
            conn.commit(); conn.close()
            return self.send_json(200, {"ok": True})
        self.send_error(404)


def main():
    os.umask(0o077)
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_DIR.chmod(0o700); DATA_DIR.chmod(0o700)
    if DB_FILE.exists(): DB_FILE.chmod(0o600)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}/"
    print("Flux está disponible en", url)
    threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
