/* ============================================================
   ARAYUZ PARCALARI
   Defter tablosu, formlar, silme onayi, SVG grafikler, bildirimler.
   Harici kutuphane yok.
   ============================================================ */
(function (kok) {
  'use strict';

  var F = kok.SR.F;

  /* ---------- temel yardimcilar ---------- */
  function kacir(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  }

  function bugun() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /* ---------- simgeler (inline SVG, ikon dosyasi yok) ---------- */
  var S = {
    ozet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 4l9 6.5"/><path d="M5.5 9.8V20h13V9.8"/><path d="M9.7 20v-5.4h4.6V20"/></svg>',
    gelir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></svg>',
    gider: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>',
    cari: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M8 4v16"/><path d="M12 9h5"/><path d="M12 13h5"/></svg>',
    daha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></svg>',
    urun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9"/><path d="M9.7 20V4"/><path d="M15.3 20v-8"/><path d="M21 20V7"/></svg>',
    rapor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>',
    ayar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
    yedek: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>',
    cikis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
    tema: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg>',
    kalem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    cop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>',
    arti: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  };

  /* ---------- bildirim ---------- */
  var bildirimZaman;
  function bildir(mesaj, hataMi) {
    var b = document.getElementById('bildirim');
    b.textContent = mesaj;
    b.classList.toggle('hata', !!hataMi);
    b.classList.add('acik');
    clearTimeout(bildirimZaman);
    bildirimZaman = setTimeout(function () { b.classList.remove('acik'); }, hataMi ? 5200 : 2600);
  }

  /* ---------- kip pencere ---------- */
  function kipAc(icerik) {
    var ortu = el('<div class="ortu"></div>');
    ortu.appendChild(icerik);
    document.body.appendChild(ortu);
    document.body.style.overflow = 'hidden';

    function kapat() {
      ortu.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', tus);
    }
    function tus(e) { if (e.key === 'Escape') kapat(); }

    ortu.addEventListener('click', function (e) { if (e.target === ortu) kapat(); });
    document.addEventListener('keydown', tus);
    return kapat;
  }

  /* ============================================================
     DEFTER — kayit listesi
     Telefonda satir-kart, genis ekranda tablo. Ayni veriden iki gorunum.
     ============================================================ */
  function defter(cfg) {
    var kart = el(
      '<section class="kart">' +
        '<div class="kart-tepe">' +
          '<div class="esne">' +
            '<h2>' + kacir(cfg.baslik) + '</h2>' +
            (cfg.aciklama ? '<p class="aciklama">' + kacir(cfg.aciklama) + '</p>' : '') +
          '</div>' +
          (cfg.ekle ? '<button class="dg ana kucuk yazdirma-gizle" data-ekle>+ Yeni</button>' : '') +
        '</div>' +
        '<div class="arac yazdirma-gizle">' +
          '<input type="search" placeholder="Ara…" data-ara aria-label="Kayıtlarda ara">' +
          '<span class="sayac" data-sayac></span>' +
          '<span class="esne"></span>' +
          '<button class="dg kucuk" data-csv>CSV</button>' +
        '</div>' +
        '<div class="kart-govde sifir" data-govde></div>' +
      '</section>'
    );

    var arama = '';
    var govde = kart.querySelector('[data-govde]');
    var sayac = kart.querySelector('[data-sayac]');

    function suzulmus() {
      var liste = cfg.satirlar();
      if (!arama) return liste;
      var a = arama.toLocaleLowerCase('tr');
      return liste.filter(function (r) {
        return cfg.kolonlar.some(function (k) {
          return String(k.ham ? k.ham(r) : r[k.anahtar] || '').toLocaleLowerCase('tr').indexOf(a) >= 0;
        });
      });
    }

    function ciz() {
      var liste = suzulmus();
      sayac.textContent = liste.length + ' kayıt';

      if (!liste.length) {
        govde.innerHTML = '<div class="bos">' +
          (arama ? 'Aramanıza uyan kayıt yok.' : 'Henüz kayıt yok.') + '</div>';
        return;
      }

      var toplamlar = cfg.toplamlar ? cfg.toplamlar(liste) : null;

      /* --- telefon: satir-kart --- */
      var mobil = '<div class="defter mobil">' + liste.map(function (r) {
        var yon = cfg.yon ? cfg.yon(r) : '';
        return '<div class="satir' + (r._bekliyor ? ' bekliyor' : '') + '"' +
            (yon ? ' data-yon="' + yon + '"' : '') + '>' +
          '<div class="ust">' + cfg.mobilBaslik(r) + '</div>' +
          '<div class="alt">' + cfg.mobilAlt(r) +
            (r._bekliyor ? '<span class="rozet">gönderilmedi</span>' : '') + '</div>' +
          '<div class="tutar">' + cfg.mobilTutar(r) + '</div>' +
          (cfg.duzenle !== false ?
            '<div class="islem yazdirma-gizle">' +
              '<button class="dg simge kucuk" data-duzenle="' + kacir(r.id) + '" aria-label="Düzenle">' + S.kalem + '</button>' +
              '<button class="dg simge kucuk tehlike" data-sil="' + kacir(r.id) + '" aria-label="Sil">' + S.cop + '</button>' +
            '</div>' : '') +
        '</div>';
      }).join('') +
      (toplamlar ? '<div class="toplam"><span>' + kacir(toplamlar.etiket || 'TOPLAM') +
        '</span><span class="deger">' + toplamlar.deger + '</span></div>' : '') +
      '</div>';

      /* --- genis ekran: tablo --- */
      var tablo = '<div class="defter-tablo"><div class="tablo-sar"><table class="t"><thead><tr>' +
        cfg.kolonlar.map(function (k) {
          return '<th' + (k.sag ? ' class="sag"' : '') + '>' + kacir(k.etiket) + '</th>';
        }).join('') +
        (cfg.duzenle !== false ? '<th class="yazdirma-gizle" style="width:92px"></th>' : '') +
        '</tr></thead><tbody>' +
        liste.map(function (r) {
          var yonT = cfg.yon ? cfg.yon(r) : '';
          return '<tr' + (r._bekliyor ? ' class="bekliyor"' : '') +
            (yonT ? ' data-yon="' + yonT + '"' : '') + '>' +
            cfg.kolonlar.map(function (k) {
              return '<td' + (k.sag ? ' class="sag"' : '') + '>' +
                (k.hucre ? k.hucre(r) : kacir(r[k.anahtar] || '')) + '</td>';
            }).join('') +
            (cfg.duzenle !== false ?
              '<td class="sag yazdirma-gizle" style="white-space:nowrap">' +
                '<button class="dg simge kucuk" data-duzenle="' + kacir(r.id) + '" aria-label="Düzenle">' + S.kalem + '</button> ' +
                '<button class="dg simge kucuk tehlike" data-sil="' + kacir(r.id) + '" aria-label="Sil">' + S.cop + '</button>' +
              '</td>' : '') +
          '</tr>';
        }).join('') +
        '</tbody>' +
        (toplamlar ? '<tfoot><tr>' +
          cfg.kolonlar.map(function (k, i) {
            if (i === 0) return '<td>' + kacir(toplamlar.etiket || 'TOPLAM') + '</td>';
            var son = i === cfg.kolonlar.length - 1;
            return '<td' + (k.sag ? ' class="sag"' : '') + '>' + (son ? toplamlar.deger : '') + '</td>';
          }).join('') +
          (cfg.duzenle !== false ? '<td class="yazdirma-gizle"></td>' : '') +
        '</tr></tfoot>' : '') +
        '</table></div></div>';

      govde.innerHTML = mobil + tablo;

      govde.querySelectorAll('[data-duzenle]').forEach(function (b) {
        b.onclick = function () { cfg.duzenleyici(b.getAttribute('data-duzenle'), ciz); };
      });
      govde.querySelectorAll('[data-sil]').forEach(function (b) {
        b.onclick = function () { cfg.silici(b.getAttribute('data-sil'), ciz); };
      });
    }

    var araKutu = kart.querySelector('[data-ara]');
    if (araKutu) {
      araKutu.oninput = function (e) { arama = e.target.value.trim(); ciz(); };
    }
    var ekleBtn = kart.querySelector('[data-ekle]');
    if (ekleBtn) ekleBtn.onclick = function () { cfg.ekle(ciz); };

    kart.querySelector('[data-csv]').onclick = function () {
      var liste = suzulmus();
      var basliklar = cfg.kolonlar.map(function (k) { return k.etiket; });
      var satirlar = liste.map(function (r) {
        return cfg.kolonlar.map(function (k) { return k.ham ? k.ham(r) : (r[k.anahtar] || ''); });
      });
      csvIndir([basliklar].concat(satirlar), cfg.baslik);
    };

    setTimeout(ciz, 0);
    kart.tazele = ciz;
    return kart;
  }

  /* ---------- CSV ---------- */
  function csvIndir(satirlar, ad) {
    var csv = '﻿' + satirlar.map(function (r) {
      return r.map(function (h) {
        var s = String(h == null ? '' : h);
        return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(';');
    }).join('\r\n');

    var a = document.createElement('a');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.href = url;
    a.download = String(ad).replace(/[^\wğüşöçıİĞÜŞÖÇ -]/gi, '').trim() + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ============================================================
     FORM — ekleme / duzenleme
     ============================================================ */
  function form(cfg, kayit, kaydet) {
    var alanlar = cfg.alanlar.map(function (a) {
      var d = kayit ? (kayit[a.anahtar] != null ? kayit[a.anahtar] : '')
                    : (typeof a.varsayilan === 'function' ? a.varsayilan()
                       : (a.varsayilan != null ? a.varsayilan : ''));

      if (a.tip === 'secim') {
        return '<div class="alan"><label for="al-' + a.anahtar + '">' + kacir(a.etiket) + '</label>' +
          '<select id="al-' + a.anahtar + '" name="' + a.anahtar + '">' +
          a.secenekler.map(function (o) {
            return '<option value="' + kacir(o) + '"' + (String(o) === String(d) ? ' selected' : '') + '>' + kacir(o) + '</option>';
          }).join('') + '</select>' +
          (a.ipucu ? '<div class="ipucu">' + kacir(a.ipucu) + '</div>' : '') + '</div>';
      }

      return '<div class="alan"><label for="al-' + a.anahtar + '">' + kacir(a.etiket) + '</label>' +
        '<input id="al-' + a.anahtar + '" name="' + a.anahtar + '" type="' + (a.tip || 'text') + '" ' +
        'value="' + kacir(d) + '"' +
        (a.tip === 'number' ? ' step="any" inputmode="decimal"' : '') + '>' +
        (a.ipucu ? '<div class="ipucu">' + kacir(a.ipucu) + '</div>' : '') + '</div>';
    }).join('');

    var kip = el(
      '<div class="kip" role="dialog" aria-modal="true">' +
        '<h3>' + (kayit ? 'Kaydı düzenle' : 'Yeni kayıt') + ' — ' + kacir(cfg.baslik) + '</h3>' +
        '<form class="icerik">' + alanlar + '</form>' +
        '<div class="ayak">' +
          '<button type="button" class="dg" data-vazgec>Vazgeç</button>' +
          '<button type="button" class="dg ana" data-tamam>' + (kayit ? 'Güncelle' : 'Ekle') + '</button>' +
        '</div>' +
      '</div>'
    );

    var kapat = kipAc(kip);
    var f = kip.querySelector('form');
    setTimeout(function () { var ilk = f.querySelector('input,select'); if (ilk) ilk.focus(); }, 60);

    kip.querySelector('[data-vazgec]').onclick = kapat;
    f.onsubmit = function (e) { e.preventDefault(); gonder(); };
    kip.querySelector('[data-tamam]').onclick = gonder;

    function gonder() {
      var fd = new FormData(f), nesne = {};
      for (var i = 0; i < cfg.alanlar.length; i++) {
        var a = cfg.alanlar[i];
        var v = fd.get(a.anahtar);

        if (a.tip === 'number') {
          v = parseFloat(String(v).replace(',', '.'));
          if (!isFinite(v)) { bildir(a.etiket + ' sayı olmalı.', true); return; }
          if (v <= 0) { bildir(a.etiket + ' sıfırdan büyük olmalı.', true); return; }
        } else {
          v = String(v == null ? '' : v).trim();
          if (!v) { bildir(a.etiket + ' boş bırakılamaz.', true); return; }
        }
        nesne[a.anahtar] = v;
      }

      var tamamBtn = kip.querySelector('[data-tamam]');
      tamamBtn.disabled = true;
      tamamBtn.innerHTML = '<span class="donuyor"></span> Kaydediliyor';

      Promise.resolve(kaydet(nesne)).then(function () {
        kapat();
      }).catch(function (h) {
        tamamBtn.disabled = false;
        tamamBtn.textContent = kayit ? 'Güncelle' : 'Ekle';
        bildir(h.message || 'Kaydedilemedi.', true);
      });
    }
  }

  /* ============================================================
     SILME ONAYI — once ne silinecegini gosterir
     ============================================================ */
  function silOnay(cfg, kayit, sil) {
    var detay = cfg.kolonlar.map(function (k) {
      return '<div class="k">' + kacir(k.etiket) + '</div><div class="d">' +
        (k.hucre ? k.hucre(kayit) : kacir(kayit[k.anahtar] || '')) + '</div>';
    }).join('');

    var kip = el(
      '<div class="kip" role="dialog" aria-modal="true">' +
        '<h3>Kaydı sil</h3>' +
        '<div class="icerik">' +
          '<div class="uyari-kutu"><b>Bu kayıt kalıcı olarak silinecek.</b><br>' +
            'Silmeden önce aşağıdaki bilgilerin doğru kayıt olduğunu kontrol edin.</div>' +
          '<div class="kd">' + detay + '</div>' +
        '</div>' +
        '<div class="ayak">' +
          '<button type="button" class="dg" data-vazgec>Vazgeç</button>' +
          '<button type="button" class="dg tehlike" data-tamam>Evet, sil</button>' +
        '</div>' +
      '</div>'
    );

    var kapat = kipAc(kip);
    kip.querySelector('[data-vazgec]').onclick = kapat;
    kip.querySelector('[data-tamam]').onclick = function () {
      var b = kip.querySelector('[data-tamam]');
      b.disabled = true;
      b.innerHTML = '<span class="donuyor"></span> Siliniyor';
      Promise.resolve(sil()).then(kapat).catch(function (h) {
        b.disabled = false;
        b.textContent = 'Evet, sil';
        bildir(h.message || 'Silinemedi.', true);
      });
    };
  }

  /* ============================================================
     GRAFIKLER — elde cizilen SVG
     ============================================================ */
  var SVGNS = 'http://www.w3.org/2000/svg';

  function sv(etiket, ozellikler) {
    var n = document.createElementNS(SVGNS, etiket);
    for (var k in ozellikler) if (ozellikler[k] != null) n.setAttribute(k, ozellikler[k]);
    return n;
  }

  function cssDeger(ad) {
    return getComputedStyle(document.documentElement).getPropertyValue(ad).trim();
  }

  function guzelTavan(v) {
    if (v <= 0) return 1;
    var us = Math.pow(10, Math.floor(Math.log10(v)));
    var oran = v / us;
    var kat = oran <= 1 ? 1 : oran <= 2 ? 2 : oran <= 2.5 ? 2.5 : oran <= 5 ? 5 : 10;
    return kat * us;
  }

  /* Ipucu balonu — dokunmatikte de calisir */
  var ipucu;
  function ipucuGoster(metin, x, y) {
    if (!ipucu) {
      ipucu = el('<div class="ipucu-kutu"></div>');
      document.body.appendChild(ipucu);
    }
    ipucu.innerHTML = metin;
    ipucu.classList.add('acik');
    var kutu = ipucu.getBoundingClientRect();
    var sol = Math.min(Math.max(8, x - kutu.width / 2), innerWidth - kutu.width - 8);
    ipucu.style.left = sol + 'px';
    ipucu.style.top = Math.max(8, y - kutu.height - 12) + 'px';
  }
  function ipucuGizle() { if (ipucu) ipucu.classList.remove('acik'); }
  document.addEventListener('scroll', ipucuGizle, true);

  /** Ogenin genisligine gore yeniden cizen sarmalayici. */
  function duyarli(kap, cizFn) {
    function ciz() {
      var g = kap.clientWidth;
      if (!g) return;
      kap.innerHTML = '';
      kap.appendChild(cizFn(g));
    }
    ciz();
    if (typeof ResizeObserver !== 'undefined') {
      var zaman;
      new ResizeObserver(function () {
        clearTimeout(zaman);
        zaman = setTimeout(ciz, 120);
      }).observe(kap);
    }
    return kap;
  }

  /**
   * Dikey cubuklar — gunluk/aylik gelir-gider.
   * items: [{k, gelir, gider}] veya [{k, v}]
   */
  function cizSutun(genislik, cfg) {
    var items = cfg.items;
    var yukseklik = cfg.yukseklik || 210;
    var ustBosluk = 14, altBosluk = 30, solBosluk = 52, sagBosluk = 6;
    var alanG = Math.max(40, genislik - solBosluk - sagBosluk);
    var alanY = yukseklik - ustBosluk - altBosluk;

    var ciftli = cfg.ciftli;
    var enBuyuk = guzelTavan(Math.max.apply(null, items.map(function (d) {
      return ciftli ? Math.max(d.gelir, d.gider) : Math.abs(d.v);
    }).concat([1])));

    var svg = sv('svg', {
      class: 'grafik', viewBox: '0 0 ' + genislik + ' ' + yukseklik,
      role: 'img', 'aria-label': cfg.etiket || 'Grafik'
    });

    /* izgara + eksen etiketleri */
    for (var i = 0; i <= 4; i++) {
      var d = enBuyuk * i / 4;
      var y = ustBosluk + alanY - (d / enBuyuk) * alanY;
      svg.appendChild(sv('line', {
        x1: solBosluk, x2: genislik - sagBosluk, y1: y, y2: y,
        class: i === 0 ? 'taban' : 'eksen'
      }));
      var t = sv('text', { x: solBosluk - 8, y: y + 3.5, 'text-anchor': 'end' });
      t.textContent = F.kisa(d);
      svg.appendChild(t);
    }

    var adim = alanG / items.length;
    var cubukG = Math.min(ciftli ? 11 : 24, (adim - 6) / (ciftli ? 2 : 1));

    items.forEach(function (dd, ix) {
      var merkez = solBosluk + adim * (ix + .5);

      function cubuk(deger, renk, kaydir) {
        if (!deger) return;
        var y = (deger / enBuyuk) * alanY;
        var x = merkez + kaydir - cubukG / 2;
        var r = Math.min(4, cubukG / 2);
        var tepe = ustBosluk + alanY - y;
        var yol = 'M' + x + ' ' + (ustBosluk + alanY) +
          ' V' + (tepe + r) +
          ' a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + (-r) +
          ' h' + (cubukG - 2 * r) +
          ' a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r +
          ' V' + (ustBosluk + alanY) + ' Z';
        var p = sv('path', { d: yol, fill: renk });
        svg.appendChild(p);
      }

      if (ciftli) {
        cubuk(dd.gelir, cssDeger('--yesil'), -cubukG / 2 - 1);
        cubuk(dd.gider, cssDeger('--kirmizi'), cubukG / 2 + 1);
      } else {
        cubuk(Math.abs(dd.v), cfg.renk || cssDeger('--mavi'), 0);
      }

      /* dokunma/hover alani */
      var vurus = sv('rect', {
        x: merkez - adim / 2, y: ustBosluk, width: adim, height: alanY,
        fill: 'transparent', style: 'cursor:pointer'
      });
      vurus.addEventListener('pointerenter', function (e) {
        ipucuGoster(cfg.ipucu(dd), e.clientX, e.clientY);
      });
      vurus.addEventListener('pointerdown', function (e) {
        ipucuGoster(cfg.ipucu(dd), e.clientX, e.clientY);
      });
      vurus.addEventListener('pointerleave', ipucuGizle);
      svg.appendChild(vurus);

      /* x etiketi — sigmazsa seyreltilir */
      var atla = Math.ceil(items.length / Math.max(2, Math.floor(alanG / 46)));
      if (ix % atla === 0) {
        var xt = sv('text', { x: merkez, y: yukseklik - 10, 'text-anchor': 'middle' });
        xt.textContent = cfg.xEtiket(dd);
        svg.appendChild(xt);
      }
    });

    return svg;
  }

  /** Cizgi — kasa ve borc egrileri. */
  function cizCizgi(genislik, cfg) {
    var noktalar = cfg.noktalar;
    var yukseklik = cfg.yukseklik || 200;
    var ustBosluk = 14, altBosluk = 28, solBosluk = 52, sagBosluk = 8;
    var alanG = Math.max(40, genislik - solBosluk - sagBosluk);
    var alanY = yukseklik - ustBosluk - altBosluk;

    var degerler = noktalar.map(function (p) { return p.v; });
    var enUst = guzelTavan(Math.max.apply(null, degerler.concat([1])));
    var enAlt = Math.min(0, Math.min.apply(null, degerler));
    var aralik = enUst - enAlt || 1;

    var X = function (i) { return solBosluk + (noktalar.length < 2 ? alanG / 2 : alanG * i / (noktalar.length - 1)); };
    var Y = function (v) { return ustBosluk + alanY - ((v - enAlt) / aralik) * alanY; };

    var svg = sv('svg', {
      class: 'grafik', viewBox: '0 0 ' + genislik + ' ' + yukseklik,
      role: 'img', 'aria-label': cfg.etiket || 'Grafik'
    });

    for (var i = 0; i <= 4; i++) {
      var d = enAlt + aralik * i / 4;
      var y = Y(d);
      svg.appendChild(sv('line', {
        x1: solBosluk, x2: genislik - sagBosluk, y1: y, y2: y,
        class: i === 0 ? 'taban' : 'eksen'
      }));
      var t = sv('text', { x: solBosluk - 8, y: y + 3.5, 'text-anchor': 'end' });
      t.textContent = F.kisa(d);
      svg.appendChild(t);
    }

    var renk = cfg.renk || cssDeger('--mavi');
    var yol = noktalar.map(function (p, i) { return (i ? 'L' : 'M') + X(i) + ' ' + Y(p.v); }).join(' ');

    /* dolgu */
    var dolgu = yol + ' L' + X(noktalar.length - 1) + ' ' + Y(enAlt) + ' L' + X(0) + ' ' + Y(enAlt) + ' Z';
    svg.appendChild(sv('path', { d: dolgu, fill: renk, opacity: .09 }));

    var cizgi = sv('path', { d: yol, fill: 'none', stroke: renk, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    svg.appendChild(cizgi);

    /* cizilme animasyonu — hareket kisitliysa CSS zaten susturur */
    try {
      var uzunluk = cizgi.getTotalLength();
      cizgi.style.strokeDasharray = uzunluk;
      cizgi.style.strokeDashoffset = uzunluk;
      cizgi.style.animation = 'cizil .7s cubic-bezier(.22,.61,.36,1) forwards';
    } catch (h) { /* getTotalLength her ortamda yok */ }

    noktalar.forEach(function (p, i) {
      var nokta = sv('circle', {
        cx: X(i), cy: Y(p.v), r: noktalar.length > 30 ? 2.5 : 4,
        fill: renk, stroke: cssDeger('--yuzey'), 'stroke-width': 2, style: 'cursor:pointer'
      });
      nokta.addEventListener('pointerenter', function (e) { ipucuGoster(cfg.ipucu(p), e.clientX, e.clientY); });
      nokta.addEventListener('pointerdown', function (e) { ipucuGoster(cfg.ipucu(p), e.clientX, e.clientY); });
      nokta.addEventListener('pointerleave', ipucuGizle);
      svg.appendChild(nokta);
    });

    var atla = Math.ceil(noktalar.length / Math.max(2, Math.floor(alanG / 62)));
    noktalar.forEach(function (p, i) {
      if (i % atla) return;
      var xt = sv('text', { x: X(i), y: yukseklik - 9, 'text-anchor': 'middle' });
      xt.textContent = cfg.xEtiket(p);
      svg.appendChild(xt);
    });

    return svg;
  }

  /** Yatay cubuk listesi — kaynak/kime dagilimi. Tablo gibi okunur. */
  function yatayListe(kalemler, renk, toplam) {
    var kap = el('<div></div>');
    var enBuyuk = Math.max.apply(null, kalemler.map(function (d) { return d.v; }).concat([1]));
    kap.innerHTML = kalemler.map(function (d, i) {
      return '<div class="cubuk-satir">' +
        '<div class="cubuk-ad">' + kacir(d.k) + '</div>' +
        '<div class="cubuk-tutar">' + F.para(d.v) +
          '<span style="color:var(--murekkep-3);font-weight:400;font-size:12px"> · ' +
          F.yuzde(d.v, toplam) + '</span></div>' +
        '<div class="cubuk-ray"><div class="cubuk-dolu" style="width:' +
          (d.v / enBuyuk * 100).toFixed(1) + '%;background:' + renk +
          ';animation-delay:' + Math.min(i * 40, 400) + 'ms"></div></div>' +
      '</div>';
    }).join('');
    return kap;
  }

  /* ---------- disari ---------- */
  kok.UI = {
    el: el, kacir: kacir, bugun: bugun, S: S,
    bildir: bildir, kipAc: kipAc,
    defter: defter, form: form, silOnay: silOnay, csvIndir: csvIndir,
    duyarli: duyarli, cizSutun: cizSutun, cizCizgi: cizCizgi, yatayListe: yatayListe,
    cssDeger: cssDeger, ipucuGizle: ipucuGizle
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
