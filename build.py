#!/usr/bin/env python3
"""Genera la web estática de Mentalit.

Uso:
  python build.py            -> genera public/ (lo que se sube a Cloudflare Pages)
  python build.py --preview  -> genera preview/ con enlaces a index.html (para ver en local sin servidor)

Para añadir una guía: crea contenido/guias/<slug>.md con su cabecera (ver las existentes)
y vuelve a ejecutar el script. El sitemap, el índice de guías y la portada se actualizan solos.
"""
import json
import math
import re
import shutil
import sys
from datetime import date
from pathlib import Path

import markdown
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).parent
PREVIEW = "--preview" in sys.argv
OUT = ROOT / ("preview" if PREVIEW else "public")
CONFIG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
CTAS = json.loads((ROOT / "contenido" / "ctas.json").read_text(encoding="utf-8"))
SITE = CONFIG["site_url"].rstrip("/")

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def fecha_larga(iso):
    d = date.fromisoformat(iso)
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


def parse_front_matter(text):
    """Cabecera sencilla entre líneas '---'. Admite 'clave: valor' y listas con '- '."""
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        raise ValueError("Falta la cabecera --- ... ---")
    meta, body = {}, m.group(2)
    key = None
    for line in m.group(1).splitlines():
        if not line.strip():
            continue
        if line.startswith("  - ") or line.startswith("- "):
            meta.setdefault(key, []).append(line.split("- ", 1)[1].strip())
        else:
            key, _, val = line.partition(":")
            key, val = key.strip(), val.strip()
            meta[key] = val if val else []
    return meta, body


def page_url(path, depth):
    """Enlace relativo desde una página a 'path' (relativo a la raíz, p. ej. 'guias/x/')."""
    prefix = "../" * depth
    if PREVIEW and (path == "" or path.endswith("/")):
        path = path + "index.html"
    return prefix + path if (prefix + path) else "./"


def render_shortcodes(html, env, depth, guia=None):
    def cta(m):
        key = m.group(1)
        data = CTAS[key]
        return env.get_template("_cta.html").render(cta=data, c=CONFIG, inline=True,
                                                     guia=guia)

    def demo(m):
        return env.get_template("_demo.html").render(demo=m.group(1), c=CONFIG)

    html = re.sub(r"<p>\{\{cta ([a-z0-9-]+)\}\}</p>", cta, html)
    html = re.sub(r"<p>\{\{demo ([a-z0-9-]+)\}\}</p>", demo, html)
    # Tablas con scroll propio en móvil
    html = html.replace("<table>", '<div class="table-wrap"><table>').replace("</table>", "</table></div>")
    if PREVIEW:
        html = re.sub(r'href="(\.\./[^"#]*/)"', r'href="\1index.html"', html)
    return html


def load_guides(env, folder="guias"):
    guides = []
    for f in sorted((ROOT / "contenido" / folder).glob("*.md")):
        meta, body = parse_front_matter(f.read_text(encoding="utf-8"))
        if meta.get("borrador") == "si":
            continue
        slug = meta.get("slug") or f.stem
        md = markdown.Markdown(extensions=["extra", "sane_lists", "toc"],
                               extension_configs={"toc": {"permalink": False}})
        html = md.convert(body)
        words = len(re.findall(r"\w+", body))
        fuentes = []
        for item in meta.get("fuentes", []):
            txt, _, url = item.partition("|")
            fuentes.append({"texto": txt.strip(), "url": url.strip()})
        guides.append({
            "slug": slug,
            "path": f"{folder}/{slug}/",
            "seccion": folder,
            "titulo": meta["titulo"],
            "seo_titulo": meta.get("seo_titulo", meta["titulo"]),
            "descripcion": meta["descripcion"],
            "entradilla": meta.get("entradilla", meta["descripcion"]),
            "fecha": meta["fecha"],
            "actualizado": meta.get("actualizado", meta["fecha"]),
            "categoria": meta.get("categoria", "Guías"),
            "imagen": meta.get("imagen", "train"),
            "relacionadas": [s.strip() for s in meta.get("relacionadas", "").split(",") if s.strip()],
            "fuentes": fuentes,
            "lectura": max(1, math.ceil(words / 220)),
            "orden": meta.get("orden", "9"),
            "body_raw": html,
        })
    guides.sort(key=lambda g: g["fecha"], reverse=True)
    return guides


def main():
    env = Environment(loader=FileSystemLoader(ROOT / "plantillas"),
                      autoescape=select_autoescape(["html"]))
    env.globals.update(c=CONFIG, ctas=CTAS, site=SITE, preview=PREVIEW, fecha_larga=fecha_larga,
                       hoy=date.today().isoformat())

    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(ROOT / "static", OUT)

    guides = load_guides(env, "guias")
    tools = load_guides(env, "herramientas") if (ROOT / "contenido" / "herramientas").exists() else []
    tools.sort(key=lambda t: t.get("orden", t["titulo"]))
    by_slug = {g["slug"]: g for g in guides + tools}
    secciones = {"guias": {"nombre": "Guías", "path": "guias/"},
                 "herramientas": {"nombre": "Herramientas", "path": "herramientas/"}}

    def write(path, html):
        target = OUT / path / "index.html" if path else OUT / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding="utf-8")

    def ctx(path, depth):
        return {"u": lambda p: page_url(p, depth), "canonical": f"{SITE}/{path}",
                "depth": depth, "path": path}

    # Guías y herramientas
    for g in guides + tools:
        depth = 2
        g["body"] = render_shortcodes(g["body_raw"], env, depth, g)
        rel = [by_slug[s] for s in g["relacionadas"] if s in by_slug]
        rel += [x for x in guides if x is not g and x not in rel]
        write(g["path"], env.get_template("guia.html").render(
            g=g, relacionadas=rel[:3], seccion=secciones[g["seccion"]], **ctx(g["path"], depth)))

    # Índices
    write("guias/", env.get_template("guias.html").render(guides=guides, **ctx("guias/", 1)))
    interactivas = [by_slug[s] for s in ("test-de-stroop", "n-back", "tecnica-pomodoro") if s in by_slug]
    if tools:
        write("herramientas/", env.get_template("herramientas.html").render(
            tools=tools, interactivas=interactivas, **ctx("herramientas/", 1)))

    # Portada
    write("", env.get_template("home.html").render(guides=guides, tools=tools, **ctx("", 0)))

    # 404
    (OUT / "404.html").write_text(
        env.get_template("404.html").render(**{**ctx("", 0), "u": lambda p: "/" + p}),
        encoding="utf-8")

    # sitemap y robots
    urls = [("", date.today().isoformat()), ("guias/", guides[0]["actualizado"] if guides else date.today().isoformat())]
    if tools:
        urls.append(("herramientas/", max(t["actualizado"] for t in tools)))
    urls += [(g["path"], g["actualizado"]) for g in guides + tools]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p, lm in urls:
        sm.append(f"  <url><loc>{SITE}/{p}</loc><lastmod>{lm}</lastmod></url>")
    sm.append("</urlset>")
    (OUT / "sitemap.xml").write_text("\n".join(sm) + "\n", encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n",
                                    encoding="utf-8")
    print(f"OK: {len(guides)} guías, {len(tools)} herramientas -> {OUT}")


if __name__ == "__main__":
    main()
