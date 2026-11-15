#!/usr/bin/env python3
"""Autocompletado de Google (España) para las semillas y las consultas del informe.

Uso: python3 scripts/autocompletar.py informe.txt datos/semillas.txt
Lo ejecuta la Action del informe de Search Console (desde GitHub no hay bloqueos).
"""
import json, re, sys, time, urllib.parse, urllib.request

def sugerencias(q):
    url = ("https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=es&ie=utf-8&oe=utf-8&q="
           + urllib.parse.quote(q))
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode("utf-8", "replace"))[1]

def main():
    informe, semillas = sys.argv[1], sys.argv[2]
    qs = [l.strip() for l in open(semillas, encoding="utf-8") if l.strip() and not l.startswith("#")]
    # Consultas del informe con >= 3 impresiones (sección CONSULTAS), sin la marca.
    sec = False
    for l in open(informe, encoding="utf-8"):
        if l.startswith("CONSULTAS"): sec = True; continue
        if sec and not l.strip(): break
        m = re.match(r"\s*(\d+) imp · .* · pos\s+[\d.]+ · (.+)$", l)
        if sec and m and int(m.group(1)) >= 3 and "mentalit" not in m.group(2).lower():
            qs.append(m.group(2).strip())
    vistos, salida = set(), ["AUTOCOMPLETADO DE GOOGLE (España)"]
    for q in qs:
        if q.lower() in vistos: continue
        vistos.add(q.lower())
        try:
            s = sugerencias(q)
        except Exception as e:
            s = [f"(error: {e.__class__.__name__})"]
        salida.append(f"  {q}: " + " | ".join(s[:10]))
        time.sleep(0.5)
    print("\n".join(salida))

if __name__ == "__main__":
    main()
