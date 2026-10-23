#!/usr/bin/env python3
"""Genera la web estática de Mentalit.

Uso:
  python build.py            -> genera public/ (lo que se sube a Cloudflare Pages)
  python build.py --preview  -> genera preview/ con enlaces a index.html (para ver en local sin servidor)

Para añadir una guía: crea contenido/guias/<slug>.md con su cabecera (ver las existentes)
y vuelve a ejecutar el script. El sitemap, el índice de guías y la portada se actualizan solos.
"""
import hashlib
import html as htmlmod
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


# ---------------------------------------------------------------------------
# Bloques interactivos en Markdown
#
#   :::ejercicio 3 min        tarjeta de ejercicio (contiene Markdown normal)
#   :::solucion               «Ver solución» desplegable (contiene Markdown)
#   :::recordar 40            lista para memorizar (palabras separadas por comas)
#   :::parejas 60             una pareja por línea: «gato = reloj»
#   :::numeros                una serie por línea: «4 7 2»
#   :::preguntas              una por línea: «Pregunta = respuesta»
#   :::sudoku                 sudoku 4×4 o 6×6, una fila por línea, «.» = casilla vacía
#   :::rotacion [rondas]      test de rotación mental (¿misma figura girada o su reflejo?); sin líneas
#   :::                       cierra el bloque abierto
# ---------------------------------------------------------------------------
CONTAINERS = {"ejercicio", "solucion"}
LEAVES = {"recordar", "parejas", "numeros", "preguntas", "sudoku", "rotacion"}


def esc(t):
    return htmlmod.escape(t.strip(), quote=True)


SUDOKU_BOX = {4: (2, 2), 6: (2, 3)}


def sudoku_count(grid, n, bh, bw, limit=2):
    """Cuenta soluciones (hasta 'limit'). grid: lista de n*n enteros, 0 = vacía."""
    g = grid[:]
    sols = []

    def ok(i, v):
        r, c = divmod(i, n)
        if any(g[r * n + k] == v for k in range(n)) or any(g[k * n + c] == v for k in range(n)):
            return False
        r0, c0 = r - r % bh, c - c % bw
        return not any(g[(r0 + a) * n + c0 + b] == v for a in range(bh) for b in range(bw))

    def rec():
        if len(sols) >= limit:
            return
        try:
            i = g.index(0)
        except ValueError:
            sols.append(g[:])
            return
        for v in range(1, n + 1):
            if ok(i, v):
                g[i] = v
                rec()
                g[i] = 0
    rec()
    return sols


def sudoku_generate(n=6, clues=None, seed=None):
    """Genera un sudoku con solución única (para usar desde la línea de comandos)."""
    import random
    rnd = random.Random(seed)
    bh, bw = SUDOKU_BOX[n]
    base = [[(bw * (r % bh) + r // bh + c) % n + 1 for c in range(n)] for r in range(n)]
    perm = list(range(1, n + 1)); rnd.shuffle(perm)
    sol = [perm[v - 1] for row in base for v in row]
    cells = list(range(n * n)); rnd.shuffle(cells)
    puzzle = sol[:]
    target = clues or (6 if n == 4 else 14)
    for i in cells:
        if sum(1 for v in puzzle if v) <= target:
            break
        keep = puzzle[i]; puzzle[i] = 0
        if len(sudoku_count(puzzle, n, bh, bw)) != 1:
            puzzle[i] = keep
    return "\n".join(" ".join(str(v) if v else "." for v in puzzle[r * n:(r + 1) * n]) for r in range(n))


def render_sudoku(lines):
    rows = [re.findall(r"[0-9.]", l) for l in lines]
    n = len(rows)
    if n not in SUDOKU_BOX or any(len(r) != n for r in rows):
        raise ValueError("El sudoku debe ser de 4×4 o 6×6, una fila por línea")
    grid = [0 if x == "." else int(x) for r in rows for x in r]
    bh, bw = SUDOKU_BOX[n]
    sols = sudoku_count(grid, n, bh, bw)
    if len(sols) != 1:
        raise ValueError(f"El sudoku tiene {len(sols)} soluciones; debe tener exactamente una")
    sol = "".join(map(str, sols[0]))
    cells = []
    for i, v in enumerate(grid):
        r, c = divmod(i, n)
        cls = ["sdk-c"]
        if (c + 1) % bw == 0 and c < n - 1: cls.append("br")
        if (r + 1) % bh == 0 and r < n - 1: cls.append("bb")
        if c == n - 1: cls.append("lc")
        if r == n - 1: cls.append("lr")
        if v:
            cls.append("given")
            cells.append(f'<button type="button" class="{" ".join(cls)}" data-i="{i}" aria-disabled="true" aria-label="Fila {r + 1}, columna {c + 1}: {v}">{v}</button>')
        else:
            cells.append(f'<button type="button" class="{" ".join(cls)}" data-i="{i}" aria-label="Fila {r + 1}, columna {c + 1}: vacía"></button>')
    keys = "".join(f'<button type="button" class="key" data-num="{k}">{k}</button>' for k in range(1, n + 1))
    keys += '<button type="button" class="key" data-num="0" aria-label="Borrar">⌫</button>'
    empty = sum(1 for v in grid if not v)
    rule = f"Rellena la cuadrícula para que cada fila, cada columna y cada bloque de {bh}×{bw} tenga los números del 1 al {n}, sin repetir."
    return (f'<div class="demo ix ix-sudoku" data-demo="sudoku" data-n="{n}" data-bh="{bh}" data-bw="{bw}" data-sol="{sol}">'
            f'<div class="demo-top"><p class="demo-name">Sudoku {n}×{n}</p>'
            f'<p class="demo-meta" data-role="meta">{empty} casillas vacías</p></div>'
            f'<p class="demo-ask">{rule}</p>'
            f'<div class="sdk sdk-{n}" data-role="board" style="--n:{n}">{"".join(cells)}</div>'
            f'<div class="sdk-pad" data-role="pad" style="--k:{n + 1}">{keys}</div>'
            f'<p class="ix-feedback" data-role="feedback" aria-live="polite" hidden></p>'
            f'<div class="demo-foot" data-role="foot"><button type="button" class="btn btn-small" data-act="hint">Pista</button>'
            f'<button type="button" class="key key-wide" data-act="reset">Borrar todo</button>'
            f'<span class="demo-hint">Toca una casilla vacía y después el número. Si no es el correcto, se marcará en rojo.</span></div></div>')


def render_leaf(kind, arg, lines):
    lines = [l.strip() for l in lines if l.strip()]
    if kind == "sudoku":
        return render_sudoku(lines)
    if kind == "rotacion":
        rounds = int(arg) if arg.strip().isdigit() else 12
        rounds = max(6, min(rounds, 30))
        return (f'<div class="demo ix ix-rot" data-demo="rotacion" data-rounds="{rounds}">'
                f'<div class="demo-top"><p class="demo-name">Rotación mental</p>'
                f'<p class="demo-meta" data-role="meta">{rounds} figuras</p></div>'
                f'<p class="demo-ask">¿La figura de la derecha es la misma que la de la izquierda, solo que girada, o es su reflejo en un espejo?</p>'
                f'<div class="rot-stage" data-role="stage"><svg class="rot-fig" data-role="a" viewBox="-64 -64 128 128" aria-hidden="true"></svg>'
                f'<svg class="rot-fig" data-role="b" viewBox="-64 -64 128 128" aria-hidden="true"></svg></div>'
                f'<div class="rot-keys" data-role="keys" hidden><button type="button" class="key" data-ans="same">Igual, girada <kbd>←</kbd></button>'
                f'<button type="button" class="key" data-ans="mirror">Es el reflejo <kbd>→</kbd></button></div>'
                f'<p class="ix-feedback" data-role="feedback" aria-live="polite" hidden></p>'
                f'<div class="demo-foot" data-role="foot"><button type="button" class="btn btn-small" data-role="start">Empezar</button>'
                f'<span class="demo-hint">Responde lo más rápido que puedas sin fallar. Mediremos tus aciertos y tu tiempo.</span></div></div>')
    if kind == "recordar":
        words = [w.strip() for w in " ".join(lines).split(",") if w.strip()]
        secs = int(arg or 40)
        items = "".join(f"<li>{esc(w)}</li>" for w in words)
        return (f'<div class="demo ix ix-recall" data-demo="recordar" data-secs="{secs}">'
                f'<div class="demo-top"><p class="demo-name">Memoriza la lista</p>'
                f'<p class="demo-meta" data-role="meta">{len(words)} palabras · {secs} s</p></div>'
                f'<ol class="word-grid" data-role="grid">{items}</ol>'
                f'<div class="words-answer" data-role="answer" hidden><label>Escribe las que recuerdes, separadas por comas o espacios'
                f'<textarea rows="3" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea></label></div>'
                f'<p class="ix-feedback" data-role="feedback" hidden></p>'
                f'<div class="demo-foot" data-role="foot"><button type="button" class="btn btn-small" data-role="start">Empezar</button>'
                f'<span class="demo-hint" data-role="hint">Al pulsar, tendrás {secs} segundos. Luego la lista se ocultará.</span></div></div>')
    if kind == "parejas":
        pairs = [tuple(x.strip() for x in l.split("=", 1)) for l in lines if "=" in l]
        secs = int(arg or 60)
        items = "".join(f'<li data-a="{esc(a)}" data-b="{esc(b)}"><span>{esc(a)}</span><span aria-hidden="true">→</span><span>{esc(b)}</span></li>' for a, b in pairs)
        return (f'<div class="demo ix ix-pairs" data-demo="parejas" data-secs="{secs}">'
                f'<div class="demo-top"><p class="demo-name">Parejas de palabras</p>'
                f'<p class="demo-meta" data-role="meta">{len(pairs)} parejas · {secs} s</p></div>'
                f'<ul class="pair-list" data-role="list">{items}</ul>'
                f'<div class="pair-quiz" data-role="quiz" hidden></div>'
                f'<p class="ix-feedback" data-role="feedback" hidden></p>'
                f'<div class="demo-foot" data-role="foot"><button type="button" class="btn btn-small" data-role="start">Empezar</button>'
                f'<span class="demo-hint" data-role="hint">Imagina una escena que una cada pareja. Luego tendrás que completar la segunda palabra.</span></div></div>')
    if kind == "numeros":
        series = [" ".join(re.findall(r"\d", l)) for l in lines]
        series = [x for x in series if x]
        items = "".join(f"<li>{esc(x)}</li>" for x in series)
        return (f'<div class="demo ix ix-digits" data-demo="numeros">'
                f'<div class="demo-top"><p class="demo-name">Series de números</p>'
                f'<div class="seg" role="group" aria-label="Modo"><button type="button" data-mode="fwd" aria-pressed="true">En orden</button>'
                f'<button type="button" data-mode="rev">Al revés</button></div></div>'
                f'<ol class="digit-list" data-role="list">{items}</ol>'
                f'<div class="digit-stage" data-role="stage" hidden><span class="digit-big" data-role="big"></span>'
                f'<span class="digit-count" data-role="count"></span></div>'
                f'<div class="series-answer" data-role="answer" hidden><label class="calc-label">Escribe la serie'
                f'<input class="calc-input" inputmode="numeric" autocomplete="off" enterkeyhint="done"></label></div>'
                f'<p class="ix-feedback" data-role="feedback" hidden></p>'
                f'<div class="demo-foot" data-role="foot"><button type="button" class="btn btn-small" data-role="start">Empezar</button>'
                f'<span class="demo-hint" data-role="hint">Verás los números de uno en uno. Después escríbelos en el orden elegido.</span></div></div>')
    if kind == "preguntas":
        qs = [tuple(x.strip() for x in l.rsplit("=", 1)) for l in lines if "=" in l]
        items = "".join(
            f'<li class="qa" data-answer="{esc(a)}"><p class="qa-q">{esc(q)}</p>'
            f'<details class="qa-sol"><summary>Ver respuesta</summary><p>{esc(a)}</p></details></li>'
            for q, a in qs)
        return f'<ol class="ix ix-qa" data-demo="preguntas">{items}</ol>'
    return ""


def preprocess_blocks(text):
    """Convierte los bloques ::: en marcadores que se sustituyen tras el Markdown."""
    out, stack, leaf, store = [], [], None, {}
    for line in text.split("\n"):
        m = re.match(r"^:::\s*([a-z]+)?\s*(.*)$", line.strip()) if line.strip().startswith(":::") else None
        if leaf is not None:
            if m and not m.group(1):
                key = f"IX{len(store)}"
                store[key] = render_leaf(leaf[0], leaf[1], leaf[2])
                out += ["", "{{" + key + "}}", ""]
                leaf = None
            else:
                leaf[2].append(line)
            continue
        if m and m.group(1) in LEAVES:
            leaf = (m.group(1), m.group(2).strip(), [])
            continue
        if m and m.group(1) in CONTAINERS:
            stack.append(m.group(1))
            key = f"IX{len(store)}"
            if m.group(1) == "ejercicio":
                meta = esc(m.group(2)) if m.group(2).strip() else ""
                store[key] = '<section class="ex-card">' + (f'<p class="ex-meta">{meta}</p>' if meta else "")
            else:
                store[key] = '<details class="ex-sol"><summary>Ver solución</summary><div class="ex-sol-body">'
            out += ["", "{{" + key + "}}", ""]
            continue
        if m and not m.group(1) and stack:
            kind = stack.pop()
            key = f"IX{len(store)}"
            store[key] = "</section>" if kind == "ejercicio" else "</div></details>"
            out += ["", "{{" + key + "}}", ""]
            continue
        out.append(line)
    if stack or leaf:
        raise ValueError("Bloque ::: sin cerrar")
    return "\n".join(out), store


def restore_blocks(html, store):
    for key, value in store.items():
        html = html.replace("<p>{{" + key + "}}</p>", value)
    return html


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
        body_md, blocks = preprocess_blocks(body)
        html = restore_blocks(md.convert(body_md), blocks)
        if "{{IX" in html:
            raise ValueError(f"{f.name}: un bloque interactivo no se ha podido colocar (deja líneas en blanco alrededor)")
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
    def short_hash(rel):
        return hashlib.md5((ROOT / "static" / rel).read_bytes()).hexdigest()[:10]
    env.globals.update(v_css=short_hash("assets/site.css"), v_js=short_hash("assets/site.js"))
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
    if "--sudoku" in sys.argv:
        # Genera un sudoku con solución única: python build.py --sudoku 6
        size = int(sys.argv[sys.argv.index("--sudoku") + 1]) if len(sys.argv) > sys.argv.index("--sudoku") + 1 else 6
        print(sudoku_generate(size))
    else:
        main()
