#!/usr/bin/env python3
"""Informe de Search Console para elegir y mejorar guías.

Uso: python3 scripts/gsc_report.py --key /ruta/clave.json [--days 28]

La clave (cuenta de servicio de solo lectura) vive en el repositorio privado
Zailerx/mentalit-secrets, nunca en este repositorio público. Solo usa
www.googleapis.com (el token y la API), que es lo que deja pasar el entorno.
"""
import argparse, json, time, datetime, urllib.request, urllib.parse, sys
import jwt  # PyJWT (pip install --break-system-packages pyjwt cryptography)

API = "https://www.googleapis.com/webmasters/v3"
TOKEN_URL = "https://www.googleapis.com/oauth2/v4/token"
SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"

def token(key):
    now = int(time.time())
    claim = {"iss": key["client_email"], "scope": SCOPE, "aud": TOKEN_URL, "iat": now, "exp": now + 3000}
    assertion = jwt.encode(claim, key["private_key"], algorithm="RS256", headers={"kid": key.get("private_key_id")})
    body = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion}).encode()
    with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=body), timeout=30) as r:
        return json.load(r)["access_token"]

def call(tok, path, payload=None):
    req = urllib.request.Request(API + path, data=json.dumps(payload).encode() if payload is not None else None,
                                 headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def query(tok, site, start, end, dims, limit=250):
    p = {"startDate": start, "endDate": end, "dimensions": dims, "rowLimit": limit, "dataState": "all"}
    return call(tok, f"/sites/{urllib.parse.quote(site, safe='')}/searchAnalytics/query", p).get("rows", [])

def main():
    a = argparse.ArgumentParser(); a.add_argument("--key", required=True); a.add_argument("--days", type=int, default=28)
    a.add_argument("--json", action="store_true", help="salida en JSON en vez de texto")
    o = a.parse_args()
    key = json.load(open(o.key)); tok = token(key)
    sites = [s["siteUrl"] for s in call(tok, "/sites").get("siteEntry", [])]
    site = next((s for s in sites if "mentalitapp.com" in s), None)
    if not site: sys.exit(f"La cuenta no tiene acceso a mentalitapp.com (ve: {sites})")
    end = datetime.date.today(); start = end - datetime.timedelta(days=o.days)
    s, e = start.isoformat(), end.isoformat()
    fmt = lambda r: {"clics": r["clicks"], "impresiones": r["impressions"], "ctr": round(r["ctr"] * 100, 1), "posicion": round(r["position"], 1)}
    by_imp = lambda rows: sorted(rows, key=lambda r: (-r["impresiones"], r["posicion"]))
    queries = by_imp([{"consulta": r["keys"][0], **fmt(r)} for r in query(tok, site, s, e, ["query"])])
    pages = by_imp([{"pagina": r["keys"][0], **fmt(r)} for r in query(tok, site, s, e, ["page"])])
    pairs = [{"consulta": r["keys"][0], "pagina": r["keys"][1], **fmt(r)} for r in query(tok, site, s, e, ["query", "page"], 500)]
    # Oportunidades: ya aparecen, pero fuera del top 3 o con pocos clics.
    opp = sorted([p for p in pairs if p["impresiones"] >= 3 and p["posicion"] > 3],
                 key=lambda p: (-p["impresiones"], p["posicion"]))[:30]
    out = {"propiedad": site, "periodo": f"{s} a {e}", "consultas": queries[:60], "paginas": pages[:40], "oportunidades": opp}
    if o.json: print(json.dumps(out, ensure_ascii=False, indent=1)); return
    print(f"Search Console {site} · {out['periodo']}\n")
    for title, rows, k in (("CONSULTAS", queries[:40], "consulta"), ("PÁGINAS", pages[:30], "pagina"), ("OPORTUNIDADES (consulta → página)", opp, "consulta")):
        print(title)
        for r in rows:
            extra = f"  → {r['pagina']}" if title.startswith("OPORT") else ""
            print(f"  {r['impresiones']:>5} imp · {r['clics']:>3} clic · pos {r['posicion']:>5} · {r[k]}{extra}")
        print()

if __name__ == "__main__":
    main()
