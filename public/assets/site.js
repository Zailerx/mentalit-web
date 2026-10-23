/* Mentalit web: demos jugables y barra de descarga. Sin dependencias ni cookies. */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(root, role) { return root.querySelector('[data-role="' + role + '"]'); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function flash(el, ok) {
    el.classList.remove("flash-ok", "flash-bad");
    void el.offsetWidth;
    el.classList.add(ok ? "flash-ok" : "flash-bad");
    setTimeout(function () { el.classList.remove("flash-ok", "flash-bad"); }, 260);
  }
  var audioCtx = null;
  function beep(times) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      for (var i = 0; i < (times || 1); i++) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        var t = audioCtx.currentTime + i * 0.35;
        o.type = "sine"; o.frequency.value = 660 + i * 220;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.32);
      }
    } catch (e) { /* sin audio */ }
  }
  function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === "suspended") audioCtx.resume(); } catch (e) {} }
  var wakeLock = null;
  function keepAwake(on) {
    try {
      if (on && navigator.wakeLock) navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; }).catch(function () {});
      else if (!on && wakeLock) { wakeLock.release(); wakeLock = null; }
    } catch (e) {}
  }
  function segSelect(group, btn) {
    group.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
  }

  /* ---------- Stroop ---------- */
  function stroop(root) {
    var COLORS = ["red", "blue", "green", "yellow"];
    var WORDS = { red: "ROJO", blue: "AZUL", green: "VERDE", yellow: "AMARILLO" };
    var total = parseInt(root.getAttribute("data-trials"), 10) || 12;
    var word = $(root, "word"), meta = $(root, "meta"), foot = $(root, "foot"), keys = $(root, "keys");
    var trials = [], idx = 0, t0 = 0, running = false, results = [];
    var footHTML = foot.innerHTML;

    function build() {
      var list = [];
      for (var i = 0; i < total; i++) {
        var ink = COLORS[i % 4];
        var congruent = i < total / 2;
        var w = ink;
        if (!congruent) { var others = COLORS.filter(function (c) { return c !== ink; }); w = others[Math.floor(Math.random() * 3)]; }
        list.push({ ink: ink, word: w, congruent: congruent });
      }
      shuffle(list);
      for (var k = 1; k < list.length; k++) { // evita repetir la misma tinta seguida
        if (list[k].ink === list[k - 1].ink) { var s = (k + 2) % list.length; var tmp = list[k]; list[k] = list[s]; list[s] = tmp; }
      }
      return list;
    }
    function show() {
      var tr = trials[idx];
      word.textContent = WORDS[tr.word];
      word.style.color = "var(--c-" + tr.ink + ")";
      meta.textContent = (idx + 1) + " de " + total;
      t0 = performance.now();
    }
    function start() {
      trials = build(); idx = 0; results = []; running = true;
      foot.innerHTML = '<span class="demo-hint">Responde rápido, pero sin fallar. Puedes usar las teclas 1 a 4.</span>';
      show();
    }
    function answer(color) {
      if (!running) return;
      var tr = trials[idx];
      var ok = color === tr.ink;
      results.push({ ok: ok, rt: performance.now() - t0, congruent: tr.congruent });
      flash(root, ok);
      idx++;
      if (idx >= total) return finish();
      word.style.visibility = "hidden";
      setTimeout(function () { word.style.visibility = ""; show(); }, 180);
    }
    function avg(arr) { return arr.length ? Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length) : 0; }
    function finish() {
      running = false;
      var hits = results.filter(function (r) { return r.ok; }).length;
      var c = avg(results.filter(function (r) { return r.ok && r.congruent; }).map(function (r) { return r.rt; }));
      var i = avg(results.filter(function (r) { return r.ok && !r.congruent; }).map(function (r) { return r.rt; }));
      var diff = i - c;
      word.textContent = hits + "/" + total;
      word.style.color = "var(--violet)";
      meta.textContent = "Resultado";
      var msg = diff > 40
        ? "Tardaste " + diff + " ms más cuando la palabra no coincidía con el color. Eso es el efecto Stroop: leer es tan automático que tienes que frenarlo."
        : "Apenas notaste diferencia entre palabras que coinciden y que no. Prueba otra vez intentando ir más rápido.";
      foot.innerHTML =
        '<div class="demo-result"><p>' + msg + '</p><div class="stat-row">' +
        '<div class="stat"><span>Aciertos</span><b>' + hits + " de " + total + "</b></div>" +
        '<div class="stat"><span>Color y palabra iguales</span><b>' + c + " ms</b></div>" +
        '<div class="stat"><span>Color y palabra distintos</span><b>' + i + " ms</b></div></div></div>" +
        '<button type="button" class="btn btn-small" data-role="again">Repetir</button>';
      $(root, "again").addEventListener("click", start);
    }
    keys.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-color]");
      if (!b) return;
      if (!running) { start(); return; }
      answer(b.getAttribute("data-color"));
    });
    root.addEventListener("click", function (e) { if (e.target.closest('[data-role="start"]')) start(); });
    document.addEventListener("keydown", function (e) {
      if (!running || e.metaKey || e.ctrlKey || e.altKey) return;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) { e.preventDefault(); answer(COLORS[n - 1]); }
    });
    void footHTML;
  }

  /* ---------- N-back ---------- */
  function nback(root) {
    var LETTERS = "BFHKLMRT".split("");
    var n = 2, seq = [], idx = -1, running = false, responded = false, timer = null, hideTimer = null;
    var stats;
    var letter = $(root, "letter"), count = $(root, "count"), ask = $(root, "ask"), hitBtn = $(root, "hit"), seg = root.querySelector(".seg");
    var foot = $(root, "foot");
    var result = document.createElement("div");
    result.className = "demo-result"; result.hidden = true;
    foot.parentNode.insertBefore(result, foot);

    function setN(v) {
      n = v;
      ask.textContent = n === 1 ? "Pulsa «Coincide» cuando la letra sea igual a la anterior."
        : "Pulsa «Coincide» cuando la letra sea igual a la de hace " + n + " turnos.";
      count.textContent = "Turno 0 de " + (20 + n);
    }
    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-n]");
      if (!b || running) return;
      segSelect(seg, b); setN(parseInt(b.getAttribute("data-n"), 10));
    });
    function build() {
      var total = 20 + n, s = [];
      for (var i = 0; i < total; i++) {
        if (i >= n && Math.random() < 0.32) s.push(s[i - n]);
        else {
          var l;
          do { l = LETTERS[Math.floor(Math.random() * LETTERS.length)]; } while (i >= n && l === s[i - n]);
          s.push(l);
        }
      }
      return s;
    }
    function step() {
      if (idx >= 0) score(responded);
      idx++;
      if (idx >= seq.length) return finish();
      responded = false;
      letter.textContent = seq[idx];
      count.textContent = "Turno " + (idx + 1) + " de " + seq.length;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { letter.textContent = ""; }, 900);
      timer = setTimeout(step, 2500);
    }
    function isTarget(i) { return i >= n && seq[i] === seq[i - n]; }
    function score(r) {
      if (idx < n) return;
      var t = isTarget(idx);
      if (t && r) stats.hits++; else if (t) stats.misses++; else if (r) stats.fa++; else stats.cr++;
    }
    function start() {
      seq = build(); idx = -1; running = true; stats = { hits: 0, misses: 0, fa: 0, cr: 0 };
      result.hidden = true; hitBtn.disabled = false;
      seg.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      $(root, "start").hidden = true;
      step();
    }
    function respond() {
      if (!running || responded || idx < 0) return;
      responded = true;
      if (idx >= n) flash(root, isTarget(idx));
      else flash(root, false);
    }
    function finish() {
      running = false; clearTimeout(timer); clearTimeout(hideTimer);
      hitBtn.disabled = true;
      seg.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
      var targets = stats.hits + stats.misses;
      var acc = Math.round(100 * (stats.hits + stats.cr) / Math.max(1, stats.hits + stats.misses + stats.fa + stats.cr));
      letter.textContent = acc + "%";
      count.textContent = "Precisión";
      var tip = acc >= 85 ? "Muy bien. Si te ha resultado fácil, sube un nivel." :
        acc >= 65 ? "Buen resultado. Repite este nivel unas cuantas veces antes de subir." :
        "Es normal que cueste al principio. Prueba un nivel más bajo y ve subiendo.";
      result.innerHTML = '<p>' + tip + '</p><div class="stat-row">' +
        '<div class="stat"><span>Coincidencias detectadas</span><b>' + stats.hits + " de " + targets + "</b></div>" +
        '<div class="stat"><span>Falsas alarmas</span><b>' + stats.fa + "</b></div></div>";
      result.hidden = false;
      var sb = $(root, "start"); sb.hidden = false; sb.textContent = "Jugar otra vez";
    }
    $(root, "start").addEventListener("click", start);
    hitBtn.addEventListener("click", respond);
    document.addEventListener("keydown", function (e) {
      if (running && (e.code === "Space" || e.key === " ")) { e.preventDefault(); respond(); }
    });
    setN(2);
  }

  /* ---------- 12 palabras ---------- */
  function palabras(root) {
    var LISTS = [
      ["manzana", "guitarra", "nube", "tijeras", "caballo", "faro", "cuchara", "globo", "tren", "almohada", "volcán", "sombrero"],
      ["llave", "delfín", "paraguas", "piano", "cohete", "limón", "escalera", "búho", "reloj", "castillo", "mochila", "fresa"]
    ];
    var which = 0, timer = null, left = 0, phase = "idle";
    var grid = $(root, "grid"), meta = $(root, "meta"), ask = $(root, "ask"), answer = $(root, "answer"), foot = $(root, "foot");
    var input = answer.querySelector("textarea");
    function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(); }
    function fill(words, cls) {
      grid.innerHTML = words.map(function (w, i) { return '<li class="' + (cls ? cls[i] : "") + '">' + w + "</li>"; }).join("");
    }
    function setFoot(html) { foot.innerHTML = html; }
    function study() {
      phase = "study"; left = 40;
      answer.hidden = true; input.value = "";
      fill(LISTS[which]);
      ask.textContent = "Memoriza la lista. Cuando se acabe el tiempo, escribe todas las que recuerdes.";
      setFoot('<button type="button" class="btn btn-small" data-act="recall">Ya las tengo</button><span class="demo-hint">Lista ' + (which + 1) + " de 2</span>");
      meta.textContent = left + " s";
      clearInterval(timer);
      timer = setInterval(function () { left--; meta.textContent = left + " s"; if (left <= 0) recall(); }, 1000);
    }
    function recall() {
      clearInterval(timer); phase = "recall";
      fill(LISTS[which].map(function () { return "?"; }));
      meta.textContent = "Tu turno";
      ask.textContent = "Escribe las palabras que recuerdes, en el orden que quieras.";
      answer.hidden = false; input.focus();
      setFoot('<button type="button" class="btn btn-small" data-act="check">Comprobar</button>');
    }
    function check() {
      phase = "done";
      var typed = norm(input.value).split(/[\s,;.]+/).filter(Boolean);
      var list = LISTS[which];
      var cls = list.map(function (w) {
        var nw = norm(w);
        return typed.some(function (t) { return t === nw || t === nw + "s" || t === nw + "es"; }) ? "hit" : "miss";
      });
      var hits = cls.filter(function (c) { return c === "hit"; }).length;
      fill(list, cls);
      answer.hidden = true;
      meta.textContent = hits + " de 12";
      ask.textContent = "Has recordado " + hits + " de 12 palabras. Las que faltan aparecen en gris.";
      which = 1 - which;
      setFoot('<button type="button" class="btn btn-small" data-act="study">Probar la lista ' + (which + 1) + '</button><span class="demo-hint">Esta vez, inventa una historia absurda que una las palabras en orden. Compara el resultado.</span>');
    }
    root.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.getAttribute("data-role") === "start" || b.getAttribute("data-act") === "study") study();
      else if (b.getAttribute("data-act") === "recall") recall();
      else if (b.getAttribute("data-act") === "check") check();
    });
    void phase;
  }

  /* ---------- Pomodoro ---------- */
  function pomodoro(root) {
    var work = 25, rest = 5, longRest = 20;
    var phase = "work", remaining = work * 60, endAt = 0, running = false, done = 0, tick = null;
    var timeEl = $(root, "time"), phaseEl = $(root, "phase"), face = root.querySelector(".pomo-face"), dots = $(root, "dots").children;
    var startBtn = $(root, "start"), seg = root.querySelector(".seg");
    var baseTitle = document.title;
    function fmt(s) { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
    function render() {
      timeEl.textContent = fmt(remaining);
      phaseEl.textContent = phase === "work" ? "Trabajo" : phase === "rest" ? "Descanso corto" : "Descanso largo";
      face.classList.toggle("rest", phase !== "work");
      for (var i = 0; i < dots.length; i++) dots[i].className = i < done ? "done" : "";
      document.title = running ? fmt(remaining) + " · " + phaseEl.textContent : baseTitle;
    }
    function next() {
      if (phase === "work") { done++; phase = done % 4 === 0 ? "long" : "rest"; beep(2); }
      else { if (phase === "long") done = 0; phase = "work"; beep(3); }
      remaining = (phase === "work" ? work : phase === "rest" ? rest : longRest) * 60;
      endAt = Date.now() + remaining * 1000;
    }
    function loop() {
      remaining = (endAt - Date.now()) / 1000;
      if (remaining <= 0) next();
      render();
    }
    function toggle() {
      unlockAudio();
      running = !running;
      if (running) { endAt = Date.now() + remaining * 1000; tick = setInterval(loop, 250); startBtn.textContent = "Pausar"; keepAwake(true); }
      else { clearInterval(tick); remaining = Math.max(0, (endAt - Date.now()) / 1000); startBtn.textContent = "Seguir"; keepAwake(false); }
      seg.querySelectorAll("button").forEach(function (b) { b.disabled = running; });
      render();
    }
    function reset() {
      clearInterval(tick); running = false; phase = "work"; done = 0; remaining = work * 60;
      startBtn.textContent = "Empezar"; keepAwake(false);
      seg.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
      render();
    }
    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-work]");
      if (!b || running) return;
      segSelect(seg, b);
      work = +b.getAttribute("data-work"); rest = +b.getAttribute("data-rest"); longRest = work === 50 ? 30 : 20;
      reset();
    });
    startBtn.addEventListener("click", toggle);
    $(root, "reset").addEventListener("click", reset);
    render();
  }

  /* ---------- Respiración ---------- */
  function respiracion(root) {
    var mins = 1, running = false, endAt = 0, timers = [];
    var ring = $(root, "ring"), word = $(root, "word"), hint = $(root, "hint"), startBtn = $(root, "start"), seg = root.querySelector(".seg");
    var baseHint = hint.textContent;
    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-min]");
      if (!b || running) return;
      segSelect(seg, b); mins = +b.getAttribute("data-min");
    });
    function clear() { timers.forEach(clearTimeout); timers = []; }
    function cycle() {
      if (!running) return;
      var leftMs = endAt - Date.now();
      if (leftMs <= 0) return stop(true);
      word.textContent = "Inspira";
      ring.style.transition = reduce ? "none" : "transform 4s ease-in-out";
      ring.style.transform = reduce ? "scale(1.6)" : "scale(2.3)";
      timers.push(setTimeout(function () {
        word.textContent = "Suelta";
        ring.style.transition = reduce ? "none" : "transform 6s ease-in-out";
        ring.style.transform = "scale(1)";
      }, 4000));
      timers.push(setTimeout(cycle, 10000));
      var m = Math.ceil(leftMs / 60000);
      hint.textContent = m > 1 ? "Quedan unos " + m + " minutos." : "Queda menos de un minuto.";
    }
    function stop(finished) {
      running = false; clear(); keepAwake(false);
      ring.style.transition = reduce ? "none" : "transform .8s ease"; ring.style.transform = "scale(1)";
      word.textContent = finished ? "Hecho" : "Listo";
      hint.textContent = finished ? "Antes de seguir, fíjate en cómo notas ahora la respiración y el cuerpo." : baseHint;
      startBtn.textContent = "Empezar";
      seg.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
      if (finished) { unlockAudio(); beep(1); }
    }
    startBtn.addEventListener("click", function () {
      if (running) return stop(false);
      unlockAudio();
      running = true; endAt = Date.now() + mins * 60000; startBtn.textContent = "Parar";
      seg.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      keepAwake(true); cycle();
    });
  }

  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function stat(label, value) { return '<div class="stat"><span>' + label + "</span><b>" + value + "</b></div>"; }

  /* ---------- Tiempo de reacción ---------- */
  function reaccion(root) {
    var N = 5, times = [], state = "idle", timer = null, t0 = 0;
    var pad = $(root, "pad"), big = $(root, "big"), small = $(root, "small"), meta = $(root, "meta"), result = $(root, "result");
    function set(st, b, s) { state = st; pad.setAttribute("data-state", st); big.textContent = b; small.textContent = s || ""; }
    function arm() {
      set("wait", "Espera…", "Toca cuando se ponga verde.");
      meta.textContent = "Intento " + (times.length + 1) + " de " + N;
      timer = setTimeout(function () {
        set("go", "¡Ya!", "");
        t0 = performance.now();
        requestAnimationFrame(function () { requestAnimationFrame(function () { if (state === "go") t0 = Math.min(performance.now(), t0 + 34); }); });
      }, 1500 + Math.random() * 2500);
    }
    function finish() {
      var sum = times.reduce(function (a, b) { return a + b; }, 0), avg = Math.round(sum / times.length), best = Math.min.apply(null, times);
      set("done", avg + " ms", "Tu media en 5 intentos. Toca para repetir.");
      meta.textContent = "Resultado";
      result.innerHTML = "<p>En laboratorio, la referencia para reaccionar a una luz ronda los 220 ms. En una pantalla suele salir algo más alto, porque el ratón, el táctil y la propia pantalla añaden su retraso.</p>" +
        '<div class="stat-row">' + stat("Media", avg + " ms") + stat("Mejor intento", best + " ms") + stat("Intentos", times.join(" · ") + " ms") + "</div>";
      result.hidden = false;
    }
    function press() {
      if (state === "idle" || state === "done") { times = []; result.hidden = true; arm(); return; }
      if (state === "wait") { clearTimeout(timer); set("early", "Demasiado pronto", "Espera a que se ponga verde. Toca para repetir el intento."); return; }
      if (state === "early" || state === "shown") { arm(); return; }
      if (state === "go") {
        times.push(Math.max(1, Math.round(performance.now() - t0)));
        if (times.length >= N) return finish();
        set("shown", times[times.length - 1] + " ms", "Toca para el siguiente intento.");
      }
    }
    var lastPointer = -1e9;
    pad.addEventListener("pointerdown", function (e) { if (e.button > 0) return; lastPointer = performance.now(); e.preventDefault(); press(); });
    // El clic que llega después de un toque o de un clic de ratón ya se ha contado en pointerdown:
    // solo se atiende el clic sin puntero (tecla Intro con el botón enfocado).
    pad.addEventListener("click", function () { if (performance.now() - lastPointer > 1000) press(); });
    document.addEventListener("keydown", function (e) {
      if ((e.code === "Space" || e.key === " ") && (state !== "idle" || document.activeElement === pad)) {
        var tag = (document.activeElement && document.activeElement.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault(); press();
      }
    });
  }

  /* ---------- Memoria visual ---------- */
  function memoria(root) {
    var grid = $(root, "grid"), meta = $(root, "meta"), ask = $(root, "ask"), result = $(root, "result"), startBtn = $(root, "start");
    var level = 1, lives = 3, target = [], found = [], accepting = false, best = 0;
    function size(l) { return l <= 2 ? 3 : l <= 5 ? 4 : l <= 9 ? 5 : 6; }
    function draw(n) {
      grid.style.setProperty("--n", n);
      var h = "";
      for (var i = 0; i < n * n; i++) h += '<button type="button" data-i="' + i + '" aria-label="Casilla ' + (i + 1) + '" disabled></button>';
      grid.innerHTML = h;
    }
    function cells() { return grid.querySelectorAll("button"); }
    function round() {
      var n = size(level), count = level + 2;
      draw(n);
      var all = []; for (var i = 0; i < n * n; i++) all.push(i);
      target = shuffle(all).slice(0, count); found = []; accepting = false;
      meta.textContent = "Nivel " + level + " · " + lives + (lives === 1 ? " vida" : " vidas");
      ask.textContent = "Memoriza " + count + " casillas…";
      setTimeout(function () {
        target.forEach(function (i) { cells()[i].classList.add("lit"); });
        setTimeout(function () {
          target.forEach(function (i) { cells()[i].classList.remove("lit"); });
          cells().forEach(function (b) { b.disabled = false; });
          accepting = true;
          ask.textContent = "Toca las " + count + " casillas que se han iluminado.";
        }, 900 + count * 120);
      }, 500);
    }
    function lose() {
      accepting = false; lives--;
      target.forEach(function (i) { if (found.indexOf(i) < 0) cells()[i].classList.add("missed"); });
      if (lives <= 0) return setTimeout(finish, 900);
      ask.textContent = "Fallo. Te quedan " + lives + (lives === 1 ? " vida." : " vidas.") + " Repetimos el nivel.";
      setTimeout(round, 1300);
    }
    function finish() {
      cells().forEach(function (b) { b.disabled = true; });
      meta.textContent = "Resultado";
      ask.textContent = "Fin de la partida.";
      result.innerHTML = "<p>Has completado " + best + (best === 1 ? " nivel" : " niveles") + ". Tu mejor marca: recordar " + (best > 0 ? best + 2 : 0) + " casillas a la vez.</p>" +
        '<div class="stat-row">' + stat("Nivel alcanzado", level) + stat("Casillas recordadas", best > 0 ? best + 2 : 0) + "</div>";
      result.hidden = false;
      startBtn.hidden = false; startBtn.textContent = "Jugar otra vez";
    }
    grid.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-i]");
      if (!b || !accepting || b.disabled) return;
      var i = +b.getAttribute("data-i");
      b.disabled = true;
      if (target.indexOf(i) >= 0) {
        b.classList.add("ok"); found.push(i);
        if (found.length === target.length) {
          accepting = false; best = level; level++;
          ask.textContent = "¡Correcto! Siguiente nivel.";
          setTimeout(round, 700);
        }
      } else { b.classList.add("bad"); lose(); }
    });
    startBtn.addEventListener("click", function () {
      level = 1; lives = 3; best = 0; result.hidden = true; startBtn.hidden = true; round();
    });
  }

  /* ---------- Agilidad mental ---------- */
  function agilidad(root) {
    var lvl = 2, ans = 0, ok = 0, skipped = 0, endAt = 0, tick = null, running = false;
    var op = $(root, "op"), input = $(root, "input"), timeEl = $(root, "time"), scoreEl = $(root, "score"), result = $(root, "result");
    var startBtn = $(root, "start"), skipBtn = $(root, "skip"), seg = root.querySelector(".seg");
    function gen() {
      var t = pick(lvl === 1 ? ["+", "-"] : ["+", "-", "×", "÷"]), a, b;
      if (lvl === 1) { a = rnd(2, 20); b = rnd(1, 10); }
      else if (lvl === 2) { a = rnd(10, 99); b = rnd(2, 49); }
      else { a = rnd(100, 999); b = rnd(11, 99); }
      if (t === "-" && b > a) { var s = a; a = b; b = s; }
      if (t === "×") { a = lvl === 2 ? rnd(2, 10) : rnd(11, 25); b = lvl === 2 ? rnd(2, 10) : rnd(3, 9); }
      if (t === "÷") { b = lvl === 2 ? rnd(2, 10) : rnd(3, 12); var q = lvl === 2 ? rnd(2, 10) : rnd(11, 30); a = b * q; }
      ans = t === "+" ? a + b : t === "-" ? a - b : t === "×" ? a * b : a / b;
      op.textContent = a + " " + (t === "-" ? "−" : t) + " " + b;
      input.value = "";
    }
    function update() {
      var left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      timeEl.textContent = left + " s";
      scoreEl.textContent = ok + (ok === 1 ? " acierto" : " aciertos");
      if (left <= 0) finish();
    }
    function finish() {
      running = false; clearInterval(tick);
      input.disabled = true; skipBtn.disabled = true;
      seg.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
      op.textContent = ok + (ok === 1 ? " acierto" : " aciertos");
      result.innerHTML = "<p>" + (ok >= 20 ? "Muy buen ritmo. Prueba el nivel siguiente." : ok >= 10 ? "Buen resultado. Repite unas cuantas veces y mira cómo sube tu marca." : "Es normal empezar despacio. Con práctica, las operaciones salen solas.") + "</p>" +
        '<div class="stat-row">' + stat("Aciertos en 60 s", ok) + stat("Saltadas", skipped) + "</div>";
      result.hidden = false;
      startBtn.hidden = false; startBtn.textContent = "Repetir";
    }
    function start() {
      ok = 0; skipped = 0; running = true; result.hidden = true; startBtn.hidden = true;
      seg.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      input.disabled = false; skipBtn.disabled = false; gen(); input.focus();
      endAt = Date.now() + 60000; update(); tick = setInterval(update, 200);
    }
    input.addEventListener("input", function () {
      if (!running) return;
      if (input.value.replace(/\s/g, "") === String(ans)) { ok++; flash(root, true); gen(); update(); }
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && running) { e.preventDefault(); if (input.value !== "") { flash(root, false); input.select(); } }
    });
    skipBtn.addEventListener("click", function () { if (running) { skipped++; gen(); input.focus(); } });
    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-level]");
      if (!b || running) return;
      segSelect(seg, b); lvl = +b.getAttribute("data-level");
    });
    startBtn.addEventListener("click", start);
  }

  /* ---------- Series numéricas ---------- */
  function series(root) {
    var TIERS = [
      [function () { var s = rnd(1, 20), k = rnd(2, 9); return lin(s, k, 5, "Se suma " + k + " cada vez."); },
       function () { var s = rnd(60, 99), k = rnd(3, 9); return lin(s, -k, 5, "Se resta " + k + " cada vez."); },
       function () { var s = rnd(1, 5); return geo(s, 2, 5, "Cada número es el doble del anterior."); }],
      [function () { var s = rnd(1, 10), d = rnd(1, 3), t = [s]; for (var i = 0; i < 5; i++) t.push(t[i] + d + i); return { t: t.slice(0, 5), a: t[5], r: "La diferencia aumenta en 1 cada vez: +" + d + ", +" + (d + 1) + ", +" + (d + 2) + "…" }; },
       function () { var s = rnd(10, 30), a = rnd(4, 9), b = rnd(1, 3), t = [s]; for (var i = 0; i < 6; i++) t.push(t[i] + (i % 2 === 0 ? a : -b)); return { t: t.slice(0, 6), a: t[6], r: "Se alterna: +" + a + " y −" + b + "." }; },
       function () { var s = rnd(1, 4); return geo(s, 3, 5, "Cada número es el triple del anterior."); },
       function () { var n = rnd(1, 4), t = []; for (var i = 0; i < 6; i++) t.push((n + i) * (n + i)); return { t: t.slice(0, 5), a: t[5], r: "Son cuadrados consecutivos: " + n + "², " + (n + 1) + "², " + (n + 2) + "²…" }; },
       function () { var a = rnd(1, 9), b = rnd(20, 40), ka = rnd(2, 4), kb = rnd(3, 6), t = []; for (var i = 0; i < 4; i++) { t.push(a + i * ka); t.push(b + i * kb); } return { t: t.slice(0, 6), a: t[6], r: "Son dos series intercaladas: en las posiciones impares se suma " + ka + " y en las pares se suma " + kb + "." }; }],
      [function () { var s = rnd(1, 5), t = [s]; for (var i = 0; i < 6; i++) t.push(i % 2 === 0 ? t[i] * 2 : t[i] + 1); return { t: t.slice(0, 6), a: t[6], r: "Se alterna: ×2 y +1." }; },
       function () { var a = rnd(1, 4), b = rnd(2, 6), t = [a, b]; for (var i = 2; i < 7; i++) t.push(t[i - 1] + t[i - 2]); return { t: t.slice(0, 6), a: t[6], r: "Cada número es la suma de los dos anteriores (como la serie de Fibonacci)." }; },
       function () { var s = rnd(2, 10), t = [s]; for (var i = 0; i < 5; i++) t.push(t[i] + Math.pow(2, i)); return { t: t.slice(0, 5), a: t[5], r: "La diferencia se duplica cada vez: +1, +2, +4, +8…" }; },
       function () { var s = rnd(1, 3), t = [s]; for (var i = 1; i < 6; i++) t.push(t[i - 1] * (i + 1)); return { t: t.slice(0, 5), a: t[5], r: "Se multiplica por 2, luego por 3, por 4, por 5…" }; },
       function () { var n = rnd(1, 3), t = []; for (var i = 0; i < 6; i++) t.push(Math.pow(n + i, 2) + 1); return { t: t.slice(0, 5), a: t[5], r: "Cada número es un cuadrado más 1: " + n + "²+1, " + (n + 1) + "²+1…" }; }]
    ];
    function lin(s, k, n, r) { var t = []; for (var i = 0; i <= n; i++) t.push(s + k * i); return { t: t.slice(0, n), a: t[n], r: r }; }
    function geo(s, k, n, r) { var t = []; for (var i = 0; i <= n; i++) t.push(s * Math.pow(k, i)); return { t: t.slice(0, n), a: t[n], r: r }; }
    var row = $(root, "row"), input = $(root, "input"), check = $(root, "check"), explain = $(root, "explain"), meta = $(root, "meta"), result = $(root, "result"), startBtn = $(root, "start");
    var list = [], idx = 0, ok = 0, phase = "idle";
    function build() {
      var plan = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2], out = [], used = {};
      plan.forEach(function (tier) {
        var opts = TIERS[tier].map(function (f, i) { return i; }).filter(function (i) { return !used[tier + "-" + i]; });
        if (!opts.length) opts = TIERS[tier].map(function (f, i) { return i; });
        var i = pick(opts); used[tier + "-" + i] = 1; out.push(TIERS[tier][i]());
      });
      return out;
    }
    function show() {
      var s = list[idx];
      row.textContent = s.t.join(" · ") + " · ?";
      meta.textContent = "Serie " + (idx + 1) + " de " + list.length;
      input.value = ""; input.disabled = false; explain.hidden = true;
      check.textContent = "Comprobar"; phase = "answer"; input.focus();
    }
    function act() {
      if (phase === "answer") {
        if (input.value.trim() === "") { input.focus(); return; }
        var s = list[idx], right = parseInt(input.value.replace(/\s/g, ""), 10) === s.a;
        if (right) ok++;
        flash(root, right);
        row.textContent = s.t.join(" · ") + " · " + s.a;
        explain.textContent = (right ? "Correcto. " : "La respuesta era " + s.a + ". ") + s.r;
        explain.hidden = false; input.disabled = true;
        check.textContent = idx + 1 < list.length ? "Siguiente" : "Ver resultado";
        phase = "review"; check.focus();
      } else if (phase === "review") {
        idx++;
        if (idx < list.length) return show();
        phase = "idle"; check.disabled = true; explain.hidden = true;
        row.textContent = ok + " de " + list.length;
        meta.textContent = "Resultado";
        result.innerHTML = "<p>" + (ok >= 8 ? "Excelente. Las series difíciles son las que más se repiten en los psicotécnicos: sigue practicándolas." : ok >= 5 ? "Buen resultado. Repasa los tipos de serie de abajo y vuelve a intentarlo." : "Las series se aprenden reconociendo patrones. Lee los tipos de abajo y repite: verás cómo mejoras rápido.") + "</p>" +
          '<div class="stat-row">' + stat("Aciertos", ok + " de " + list.length) + "</div>";
        result.hidden = false; startBtn.hidden = false; startBtn.textContent = "Otras 10 series";
      }
    }
    check.addEventListener("click", act);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); act(); } });
    startBtn.addEventListener("click", function () {
      list = build(); idx = 0; ok = 0; result.hidden = true; startBtn.hidden = true; check.disabled = false; show();
    });
  }

  /* ---------- Piezas interactivas de las guías ---------- */
  function norm(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[€%.,;:¡!¿?«»"()\-–—]/g, " ").replace(/\s+/g, " ").trim();
  }
  function sameAnswer(given, expected) {
    var g = norm(given), e = norm(expected);
    if (!g) return false;
    var gn = parseFloat(String(given).replace(",", ".").replace(/[^\d.\-]/g, ""));
    var en = parseFloat(String(expected).replace(",", ".").replace(/[^\d.\-]/g, ""));
    if (!isNaN(gn) && !isNaN(en) && /\d/.test(expected)) return Math.abs(gn - en) < 0.005;
    if (g === e) return true;
    var ew = e.split(" "), gw = g.split(" "), hit = 0;
    ew.forEach(function (w) { if (w.length > 2 && gw.indexOf(w) >= 0) hit++; });
    var key = ew.filter(function (w) { return w.length > 2; }).length || 1;
    return hit / key >= 0.6;
  }
  function sing(w) { return w.replace(/(es|s)$/, ""); }
  function escHtml(t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
  function feedback(root, text) { var f = $(root, "feedback"); f.textContent = text; f.hidden = false; }
  function countdown(root, secs, done) {
    var meta = $(root, "meta"), left = secs, base = meta.textContent;
    meta.textContent = left + " s";
    var t = setInterval(function () {
      left--; meta.textContent = left + " s";
      if (left <= 0) { clearInterval(t); meta.textContent = base; done(); }
    }, 1000);
    return function () { clearInterval(t); meta.textContent = base; };
  }

  function recordar(root) {
    var grid = $(root, "grid"), answer = $(root, "answer"), foot = $(root, "foot"), input = answer.querySelector("textarea");
    var words = Array.prototype.map.call(grid.children, function (li) { return li.textContent; });
    var secs = +root.getAttribute("data-secs") || 40, stop = null;
    grid.classList.add("is-covered");
    function setFoot(html) { foot.innerHTML = html; }
    function study() {
      grid.classList.remove("is-covered");
      Array.prototype.forEach.call(grid.children, function (li) { li.className = ""; });
      answer.hidden = true; $(root, "feedback").hidden = true; input.value = "";
      setFoot('<button type="button" class="btn btn-small" data-act="recall">Ya las tengo</button><span class="demo-hint">Memoriza todas las palabras que puedas.</span>');
      stop = countdown(root, secs, recall);
    }
    function recall() {
      if (stop) stop();
      grid.classList.add("is-covered"); answer.hidden = false; input.focus();
      setFoot('<button type="button" class="btn btn-small" data-act="check">Comprobar</button>');
    }
    function check() {
      var typed = norm(input.value).split(" ");
      var hits = 0;
      Array.prototype.forEach.call(grid.children, function (li, i) {
        var w = norm(words[i]);
        var ok = typed.some(function (t) { return t && (sing(t) === sing(w) || w.split(" ").length > 1 && w.split(" ").indexOf(t) >= 0); });
        li.className = ok ? "hit" : "miss"; if (ok) hits++;
      });
      grid.classList.remove("is-covered"); answer.hidden = true;
      feedback(root, "Has recordado " + hits + " de " + words.length + ". Las que faltan aparecen en gris.");
      setFoot('<button type="button" class="btn btn-small" data-act="study">Repetir</button>');
    }
    root.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var a = b.getAttribute("data-act") || b.getAttribute("data-role");
      if (a === "start" || a === "study") study(); else if (a === "recall") recall(); else if (a === "check") check();
    });
  }

  function parejas(root) {
    var list = $(root, "list"), quiz = $(root, "quiz"), foot = $(root, "foot");
    var pairs = Array.prototype.map.call(list.children, function (li) { return [li.getAttribute("data-a"), li.getAttribute("data-b")]; });
    var secs = +root.getAttribute("data-secs") || 60, stop = null;
    list.classList.add("is-covered");
    function setFoot(html) { foot.innerHTML = html; }
    function study() {
      list.hidden = false; list.classList.remove("is-covered"); quiz.hidden = true; $(root, "feedback").hidden = true;
      setFoot('<button type="button" class="btn btn-small" data-act="recall">Ya las tengo</button><span class="demo-hint">Imagina una escena para cada pareja.</span>');
      stop = countdown(root, secs, recall);
    }
    function recall() {
      if (stop) stop();
      list.hidden = true;
      var order = shuffle(pairs.map(function (p, i) { return i; }));
      quiz.innerHTML = order.map(function (i) {
        return '<label class="pair-row" data-i="' + i + '"><span>' + escHtml(pairs[i][0]) + ' →</span><input autocomplete="off" autocapitalize="off" spellcheck="false"><em hidden></em></label>';
      }).join("");
      quiz.hidden = false; quiz.querySelector("input").focus();
      setFoot('<button type="button" class="btn btn-small" data-act="check">Comprobar</button>');
    }
    function check() {
      var hits = 0;
      quiz.querySelectorAll(".pair-row").forEach(function (row) {
        var p = pairs[+row.getAttribute("data-i")], inp = row.querySelector("input"), em = row.querySelector("em");
        var ok = sameAnswer(inp.value, p[1]) || sing(norm(inp.value)) === sing(norm(p[1]));
        row.classList.add(ok ? "ok" : "bad"); inp.disabled = true;
        if (!ok) { em.textContent = p[1]; em.hidden = false; } else hits++;
      });
      feedback(root, "Has acertado " + hits + " de " + pairs.length + " parejas.");
      setFoot('<button type="button" class="btn btn-small" data-act="study">Repetir</button>');
    }
    root.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var a = b.getAttribute("data-act") || b.getAttribute("data-role");
      if (a === "start" || a === "study") study(); else if (a === "recall") recall(); else if (a === "check") check();
    });
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
      e.preventDefault();
      var inputs = Array.prototype.slice.call(quiz.querySelectorAll("input")), i = inputs.indexOf(e.target);
      if (i < inputs.length - 1) inputs[i + 1].focus(); else check();
    });
  }

  function numeros(root) {
    var list = $(root, "list"), stage = $(root, "stage"), big = $(root, "big"), count = $(root, "count");
    var answer = $(root, "answer"), input = answer.querySelector("input"), foot = $(root, "foot"), seg = root.querySelector(".seg");
    var series = Array.prototype.map.call(list.children, function (li) { return li.textContent.split(" "); });
    var mode = "fwd", idx = 0, ok = 0, timers = [];
    list.hidden = true;
    function setFoot(html) { foot.innerHTML = html; }
    function clear() { timers.forEach(clearTimeout); timers = []; }
    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-mode]"); if (!b) return;
      segSelect(seg, b); mode = b.getAttribute("data-mode");
    });
    function show() {
      clear(); answer.hidden = true; $(root, "feedback").hidden = true; stage.hidden = false;
      seg.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      var s = series[idx];
      count.textContent = "Serie " + (idx + 1) + " de " + series.length + " · " + s.length + " números";
      big.textContent = "";
      setFoot('<span class="demo-hint">Mira con atención…</span>');
      s.forEach(function (d, i) {
        timers.push(setTimeout(function () { big.textContent = d; }, 600 + i * 1000));
        timers.push(setTimeout(function () { big.textContent = ""; }, 600 + i * 1000 + 750));
      });
      timers.push(setTimeout(function () {
        big.textContent = "?"; answer.hidden = false; input.value = ""; input.focus();
        setFoot('<button type="button" class="btn btn-small" data-act="check">Comprobar</button><span class="demo-hint">' + (mode === "rev" ? "Escríbela al revés." : "Escríbela en el mismo orden.") + '</span>');
      }, 600 + s.length * 1000));
    }
    function check() {
      var s = series[idx], target = (mode === "rev" ? s.slice().reverse() : s).join("");
      var given = input.value.replace(/\D/g, "");
      var right = given === target; if (right) ok++;
      big.textContent = (mode === "rev" ? s.slice().reverse() : s).join(" ");
      answer.hidden = true;
      feedback(root, right ? "¡Correcto!" : "La serie era " + (mode === "rev" ? s.slice().reverse() : s).join(" - ") + ".");
      idx++;
      if (idx < series.length) setFoot('<button type="button" class="btn btn-small" data-act="next">Siguiente serie</button>');
      else {
        feedback(root, (right ? "¡Correcto! " : "") + "Has acertado " + ok + " de " + series.length + " series. Prueba ahora el otro modo.");
        seg.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
        setFoot('<button type="button" class="btn btn-small" data-act="restart">Empezar de nuevo</button>');
      }
    }
    root.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act], button[data-role=start]"); if (!b) return;
      var a = b.getAttribute("data-act") || "start";
      if (a === "start" || a === "restart") { idx = 0; ok = 0; show(); }
      else if (a === "next") show(); else if (a === "check") check();
    });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); check(); } });
  }

  function preguntas(root) {
    root.querySelectorAll(".qa").forEach(function (li) {
      var expected = li.getAttribute("data-answer"), det = li.querySelector(".qa-sol");
      var row = document.createElement("div");
      row.className = "qa-row";
      row.innerHTML = '<input autocomplete="off" aria-label="Tu respuesta" placeholder="Tu respuesta"><button type="button" class="key key-wide">Comprobar</button><span class="qa-mark" aria-live="polite"></span>';
      li.insertBefore(row, det);
      var inp = row.querySelector("input"), mark = row.querySelector(".qa-mark");
      function go() {
        if (!inp.value.trim()) { inp.focus(); return; }
        var ok = sameAnswer(inp.value, expected);
        li.classList.remove("ok", "bad"); li.classList.add(ok ? "ok" : "bad");
        mark.textContent = ok ? "¡Correcto!" : "No es eso";
        if (ok) det.open = true;
      }
      row.querySelector("button").addEventListener("click", go);
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
    });
  }

  function sudoku(root) {
    var n = +root.getAttribute("data-n"), bh = +root.getAttribute("data-bh"), bw = +root.getAttribute("data-bw");
    var sol = root.getAttribute("data-sol"), board = $(root, "board"), pad = $(root, "pad"), meta = $(root, "meta");
    var cells = Array.prototype.slice.call(board.children), sel = -1, mistakes = 0, hints = 0, t0 = 0, done = false;
    function rc(i) { return [Math.floor(i / n), i % n]; }
    function sameUnit(a, b) {
      var A = rc(a), B = rc(b);
      return A[0] === B[0] || A[1] === B[1] ||
        (Math.floor(A[0] / bh) === Math.floor(B[0] / bh) && Math.floor(A[1] / bw) === Math.floor(B[1] / bw));
    }
    function open() { return cells.filter(function (c) { return !c.classList.contains("given") && c.textContent !== sol[+c.getAttribute("data-i")]; }).length; }
    function paint() {
      var v = sel >= 0 ? cells[sel].textContent : "";
      cells.forEach(function (c, i) {
        c.classList.toggle("sel", i === sel);
        c.classList.toggle("peer", sel >= 0 && i !== sel && sameUnit(i, sel));
        c.classList.toggle("same", !!v && i !== sel && c.textContent === v);
      });
      var left = open();
      meta.textContent = left ? left + (left === 1 ? " casilla" : " casillas") + " por resolver" : "¡Completado!";
    }
    function select(i) {
      if (done) return;
      sel = i; paint();
    }
    function put(num) {
      if (done || sel < 0) return;
      var c = cells[sel];
      if (c.classList.contains("given") || c.classList.contains("fixed")) return;
      if (!t0) t0 = Date.now();
      c.classList.remove("bad", "ok");
      if (!num) { c.textContent = ""; c.setAttribute("aria-label", c.getAttribute("aria-label").replace(/:.*$/, ": vacía")); paint(); return; }
      c.textContent = String(num);
      c.setAttribute("aria-label", c.getAttribute("aria-label").replace(/:.*$/, ": " + num));
      if (String(num) === sol[sel]) { c.classList.add("ok", "fixed"); }
      else { c.classList.add("bad"); mistakes++; }
      paint();
      if (!open()) finish();
    }
    function finish() {
      done = true; sel = -1; paint(); root.classList.add("is-solved");
      var secs = t0 ? Math.round((Date.now() - t0) / 1000) : 0;
      var time = secs >= 60 ? Math.floor(secs / 60) + " min " + (secs % 60) + " s" : secs + " s";
      feedback(root, "¡Resuelto en " + time + "! " +
        (mistakes ? "Te has equivocado " + mistakes + (mistakes === 1 ? " vez" : " veces") : "Sin ningún error") +
        (hints ? " y has usado " + hints + (hints === 1 ? " pista." : " pistas.") : "."));
    }
    function hint() {
      if (done) return;
      var i = sel >= 0 && cells[sel].textContent !== sol[sel] && !cells[sel].classList.contains("given") ? sel : -1;
      if (i < 0) for (var k = 0; k < cells.length; k++) {
        if (!cells[k].classList.contains("given") && cells[k].textContent !== sol[k]) { i = k; break; }
      }
      if (i < 0) return;
      hints++; sel = i; put(+sol[i]); cells[i].classList.add("hinted");
    }
    function reset() {
      cells.forEach(function (c) {
        if (c.classList.contains("given")) return;
        c.textContent = ""; c.className = c.className.replace(/\b(ok|bad|fixed|hinted)\b/g, "").replace(/\s+/g, " ").trim();
      });
      sel = -1; mistakes = 0; hints = 0; t0 = 0; done = false;
      root.classList.remove("is-solved"); $(root, "feedback").hidden = true; paint();
    }
    board.addEventListener("click", function (e) {
      var c = e.target.closest(".sdk-c"); if (!c) return;
      select(+c.getAttribute("data-i"));
    });
    pad.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-num]"); if (!b) return;
      put(+b.getAttribute("data-num"));
    });
    root.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]"); if (!b) return;
      var a = b.getAttribute("data-act");
      if (a === "hint") hint(); else if (a === "reset") reset();
    });
    board.addEventListener("keydown", function (e) {
      if (sel < 0) return;
      var k = e.key, r = rc(sel);
      if (/^[1-9]$/.test(k) && +k <= n) { put(+k); e.preventDefault(); }
      else if (k === "Backspace" || k === "Delete" || k === "0") { put(0); e.preventDefault(); }
      else {
        var d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k];
        if (!d) return;
        var nr = (r[0] + d[0] + n) % n, nc = (r[1] + d[1] + n) % n;
        select(nr * n + nc); cells[sel].focus(); e.preventDefault();
      }
    });
    paint();
  }

  var DEMOS = { stroop: stroop, nback: nback, palabras: palabras, pomodoro: pomodoro, respiracion: respiracion,
    reaccion: reaccion, memoria: memoria, agilidad: agilidad, series: series,
    recordar: recordar, parejas: parejas, numeros: numeros, preguntas: preguntas, sudoku: sudoku };
  document.querySelectorAll("[data-demo]").forEach(function (el) {
    var fn = DEMOS[el.getAttribute("data-demo")];
    if (fn) { try { fn(el); } catch (e) { /* una demo rota no debe romper la página */ } }
  });

  /* ---------- Barra de descarga en móvil ---------- */
  var bar = document.querySelector('[data-role="sticky"]');
  if (bar) {
    var closed = false;
    try { closed = sessionStorage.getItem("mx-bar") === "1"; } catch (e) {}
    var onScroll = function () {
      if (closed) return;
      bar.hidden = window.scrollY < 700;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    bar.querySelector(".sticky-close").addEventListener("click", function () {
      closed = true; bar.hidden = true;
      try { sessionStorage.setItem("mx-bar", "1"); } catch (e) {}
    });
  }
})();
