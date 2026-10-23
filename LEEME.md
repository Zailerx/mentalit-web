# Web de Mentalit

Web estática con portada, índice de guías y guías con ejercicios jugables. No necesita servidor ni base de datos: se aloja gratis en Cloudflare Pages.

## Carpetas

- `public/`: la web terminada. **Esto es lo que se sube.**
- `contenido/guias/`: una guía por archivo `.md`.
- `contenido/herramientas/`: los tests online (misma cabecera que las guías, más `orden`).
- `contenido/ctas.json`: los textos de las llamadas a descargar la app.
- `plantillas/`: el diseño de las páginas.
- `static/`: estilos, scripts, fuentes e imágenes.
- `config.json`: dominio, enlace de la App Store, contacto.
- `build.py`: genera `public/` a partir de todo lo anterior.
- `PLAN-DE-CONTENIDO.md`: las próximas guías a escribir.

## Generar la web

Necesitas Python 3 con `markdown` y `jinja2` (`pip install markdown jinja2`).

```
python build.py
```

Para verla en tu ordenador:

```
cd public
python -m http.server 8000
```

y abre http://localhost:8000.

## Añadir una guía

1. Crea `contenido/guias/mi-guia.md` copiando la cabecera de otra guía.
2. Escribe el texto en Markdown. Puedes usar:
   - `{{cta memoria}}`, `{{cta foco}}`, `{{cta meditacion}}`, `{{cta stroop}}`, `{{cta nback}}`, `{{cta calculo}}`, `{{cta logica}}`, `{{cta atencion}}`, `{{cta general}}` para una llamada a la app.
   - `{{demo stroop}}`, `{{demo nback}}`, `{{demo palabras}}`, `{{demo pomodoro}}`, `{{demo respiracion}}`, `{{demo reaccion}}`, `{{demo memoria}}`, `{{demo agilidad}}`, `{{demo series}}` para un ejercicio jugable.
   - Enlaces a otras guías con `../slug-de-la-guia/` y a herramientas con `../../herramientas/slug/`.
3. Ejecuta `python build.py`. La portada, el índice y el sitemap se actualizan solos.

## Ejercicios interactivos dentro de las guías

Bloques que se abren con `:::nombre` y se cierran con `:::` (cada uno en su propia línea, con líneas en blanco alrededor):

- `:::ejercicio 3 minutos` … `:::` tarjeta de ejercicio. Dentro va Markdown normal (título `##`, texto, listas…).
- `:::solucion` … `:::` solución oculta tras «Ver solución».
- `:::recordar 40` lista de palabras separadas por comas para memorizar durante 40 s; luego se ocultan y se comprueban.
- `:::parejas 60` una pareja por línea (`gato = reloj`); se memorizan y luego se completa la segunda palabra.
- `:::numeros` una serie por línea (`4 7 2`); se muestran de una en una y se escriben en orden o al revés.
- `:::preguntas` una por línea (`Pregunta = respuesta`); el lector escribe y comprueba, o abre la respuesta.
- `:::sudoku` sudoku jugable de 4×4 o 6×6: una fila por línea, números separados por espacios y `.` en las casillas vacías. Al generar la web se comprueba que tenga una única solución (si no, da error). Para obtener uno nuevo: `python build.py --sudoku 4` o `python build.py --sudoku 6`.

Los bloques `recordar`, `parejas`, `numeros` y `preguntas` pueden ir dentro de un `:::ejercicio`.

## Cuando tengas dominio

Cambia `site_url` en `config.json` (por ejemplo `https://mentalit.es`) y vuelve a generar la web. Las URL canónicas y el sitemap usan ese valor.

## Publicar en Cloudflare Pages (resumen)

1. Sube esta carpeta a un repositorio de GitHub propio (no dentro del de la app).
2. En Cloudflare: Workers & Pages → Create → Pages → conectar con GitHub.
3. Configuración: sin comando de compilación, carpeta de salida `public`.
4. Añade tu dominio en la pestaña Custom domains.
5. En Google Search Console, añade la propiedad del dominio y envía `https://tu-dominio/sitemap.xml`.
