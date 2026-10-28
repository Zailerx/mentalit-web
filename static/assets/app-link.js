/* Mentalit · enlace de descarga (mentalitapp.com/app)
   - Safari / Chrome: va directo a la App Store (iPhone/iPad) o a Google Play (Android).
   - Navegador interno de TikTok: no deja abrir la tienda, así que se intenta saltar al
     navegador del sistema y, si no se puede, se explica cómo hacerlo (••• → Abrir en el navegador).
   - Instagram / Facebook / otros navegadores internos: se intenta abrir la tienda y, si a los
     pocos segundos seguimos aquí, se muestra el mismo aviso.
   - Ordenador: se muestran los dos botones.
   Medición opcional: añade ?de=tiktok o ?de=instagram al enlace de cada bio. */
(function () {
  'use strict';

  var APP_STORE = 'https://apps.apple.com/es/app/mentalit-entrena-tu-mente/id6817341061';
  var APP_STORE_ID = '6817341061';
  var PLAY_ID = 'com.mente.entrenamiento';
  // Opcional: "provider token" de App Store Connect (Analíticas de apps → Fuentes → Campañas).
  // Con él, cada ?de=... aparece como campaña en App Store Connect.
  var APP_STORE_PT = '129128602';

  var ua = navigator.userAgent || '';
  var params = new URLSearchParams(location.search);
  var source = (params.get('de') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);

  var isAndroid = /Android/i.test(ua);
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var inTikTok = /BytedanceWebview|musical_ly|trill_|TikTok/i.test(ua);
  var inInstagram = /Instagram/i.test(ua);
  var inFacebook = /FBAN|FBAV|FB_IAB|FBIOS/i.test(ua);
  var inOtherWebview = /; wv\)|Snapchat|Line\/|Twitter|Threads/i.test(ua);
  var inApp = inTikTok || inInstagram || inFacebook || inOtherWebview;

  // Registro de intentos (útil para probar; no se envía a ningún sitio).
  var attempts = window.__mentalitAttempts = [];

  function appStoreUrl() {
    if (APP_STORE_PT) {
      return 'https://apps.apple.com/app/apple-store/id' + APP_STORE_ID +
        '?pt=' + encodeURIComponent(APP_STORE_PT) + '&ct=' + encodeURIComponent(source || 'enlace-app') + '&mt=8';
    }
    return APP_STORE;
  }
  function playReferrer() {
    return source ? encodeURIComponent('utm_source=' + source + '&utm_medium=bio&utm_campaign=link_bio') : '';
  }
  function playUrl() {
    var r = playReferrer();
    return 'https://play.google.com/store/apps/details?id=' + PLAY_ID + (r ? '&referrer=' + r : '');
  }
  function playIntent() {
    var r = playReferrer();
    return 'intent://details?id=' + PLAY_ID + (r ? '&referrer=' + r : '') +
      '#Intent;scheme=market;package=com.android.vending;end';
  }
  function storeUrl() { return isAndroid ? playUrl() : appStoreUrl(); }
  function storeName() { return isAndroid ? 'Google Play' : 'la App Store'; }

  function go(url) {
    attempts.push(url);
    try { window.location.href = url; } catch (e) { /* algunos navegadores internos lanzan error */ }
  }

  var $ = function (id) { return document.getElementById(id); };
  var status = $('estado'), ios = $('ios'), android = $('android'), exit = $('salir');

  ios.href = appStoreUrl();
  android.href = playUrl();

  // Si la tienda llega a abrirse, la página pasa a segundo plano: entonces no hace falta el aviso.
  var left = false;
  document.addEventListener('visibilitychange', function () { if (document.hidden) left = true; });
  window.addEventListener('pagehide', function () { left = true; });

  function showExit() {
    if (left) return;
    $('paso2').textContent = isIOS && inInstagram ? 'Elige «Abrir en navegador externo»' :
      isIOS ? 'Elige «Abrir en el navegador» (Safari)' : 'Elige «Abrir en el navegador» (Chrome)';
    $('destino').textContent = 'Se abrirá ' + storeName() + ' directamente para instalar Mentalit.';
    exit.hidden = false;
  }
  function watchThenExit(ms) { setTimeout(showExit, ms); }

  $('reintentar').addEventListener('click', function (e) {
    e.preventDefault();
    exit.hidden = true;
    left = false;
    go(isAndroid && inApp ? playIntent() : storeUrl());
    watchThenExit(2500);
  });

  if (!isIOS && !isAndroid) {
    // Ordenador u otro dispositivo: elegir tienda.
    status.textContent = 'Descárgala en tu móvil:';
    return;
  }

  // En el móvil solo se enseña el botón de su tienda.
  (isAndroid ? ios : android).hidden = true;

  if (!inApp) {
    // Safari / Chrome: directo a la tienda. El botón queda como respaldo.
    status.textContent = 'Abriendo ' + storeName() + '…';
    go(storeUrl());
    return;
  }

  if (isAndroid) {
    // Android: abrir Google Play directamente; si el navegador interno lo bloquea, aviso.
    status.textContent = 'Abriendo Google Play…';
    go(playIntent());
    watchThenExit(inTikTok ? 1500 : 2500);
    return;
  }

  if (inTikTok) {
    // iPhone + TikTok: TikTok bloquea la App Store. Se intenta abrir esta misma página en Safari
    // (iOS 17+); si TikTok lo impide, el aviso explica cómo hacerlo.
    showExit();
    var once = 'mentalit-safari-try';
    var tried = false;
    try { tried = sessionStorage.getItem(once) === '1'; sessionStorage.setItem(once, '1'); } catch (e) {}
    if (!tried) go('x-safari-' + location.href);
    return;
  }

  // iPhone + Instagram / Facebook / otros: normalmente dejan abrir la App Store.
  status.textContent = 'Abriendo la App Store…';
  go(appStoreUrl());
  watchThenExit(2500);
})();
