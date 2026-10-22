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

  var DEMOS = { stroop: stroop, nback: nback, palabras: palabras, pomodoro: pomodoro, respiracion: respiracion };
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
