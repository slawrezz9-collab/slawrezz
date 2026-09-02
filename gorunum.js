/* ============================================================
   GORUNUMLER
   Her sayfa bir fonksiyon; DOM ogesi dondurur.
   Tum rakamlar hesap.js'ten gelir — burada is kurali hesaplanmaz.
   ============================================================ */
(function (kok) {
  'use strict';

  var F = kok.SR.F;
  var U = kok.UI;
  var el = U.el, kacir = U.kacir;

  function H() { return kok.Depo.hesap(); }
  function renk(ad) { return U.cssDeger(ad); }

  /* ---------- kucuk parcalar ---------- */
  function cumle(metin) {
    return '<p class="cumle">' + kacir(metin) + '</p>';
  }

  function kutu(etiket, deger, not, tur) {
    return '<div class="kutu' + (tur ? ' ' + tur : '') + '">' +
      '<span class="etiket">' + kacir(etiket) + '</span>' +
      '<div class="deger">' + deger + '</div>' +
      (not ? '<div class="not">' + kacir(not) + '</div>' : '') +
    '</div>';
  }

  function grafikKart(baslik, aciklama, cizFn, dipnot) {
    var k = el(
      '<section class="kart">' +
        '<div class="kart-tepe"><div class="esne"><h2>' + kacir(baslik) + '</h2>' +
        (aciklama ? '<p class="aciklama">' + kacir(aciklama) + '</p>' : '') + '</div></div>' +
        '<div class="kart-govde"><div data-cizim></div>' +
        (dipnot ? '<p class="aciklama" style="margin-top:12px">' + kacir(dipnot) + '</p>' : '') +
        '</div>' +
      '</section>'
    );
    setTimeout(function () { U.duyarli(k.querySelector('[data-cizim]'), cizFn); }, 0);
    return k;
  }

  /* ============================================================
     TABLO YAPILANDIRMALARI
     ============================================================ */
  var CFG = {
    siparisler: function () {
      return {
        tablo: 'siparisler',
        baslik: 'Bircan Abi\'den mal alımları',
        aciklama: 'Bu satırlar bizim maliyetimizdir, gelir değildir. Tutar = adet × birim fiyat.',
        satirlar: function () { return H().siparisler().slice().reverse(); },
        yon: function () { return 'gider'; },
        kolonlar: [
          { etiket: 'Tarih', anahtar: 't', hucre: function (r) { return F.tarih(r.t); }, ham: function (r) { return F.tarih(r.t); } },
          { etiket: 'Ürün', anahtar: 'urun' },
          { etiket: 'Adet', anahtar: 'adet', sag: true, hucre: function (r) { return F.sayi(r.adet); }, ham: function (r) { return r.adet; } },
          { etiket: 'Birim fiyat', anahtar: 'fiyat', sag: true, hucre: function (r) { return F.para(r.fiyat); }, ham: function (r) { return r.fiyat; } },
          { etiket: 'Alım tutarı', anahtar: 'toplam', sag: true, hucre: function (r) { return '<b>' + F.para(r.toplam) + '</b>'; }, ham: function (r) { return r.toplam; } }
        ],
        mobilBaslik: function (r) { return kacir(r.urun); },
        mobilAlt: function (r) {
          return '<span>' + F.tarih(r.t) + '</span><span>' + F.sayi(r.adet) + ' × ' + F.para(r.fiyat) + '</span>';
        },
        mobilTutar: function (r) { return F.para(r.toplam); },
        toplamlar: function (liste) {
          return {
            etiket: 'TOPLAM (' + liste.length + ' alım)',
            deger: F.para(liste.reduce(function (t, r) { return t + r.toplam; }, 0))
          };
        },
        alanlar: [
          { anahtar: 't', etiket: 'Alım tarihi', tip: 'date', varsayilan: U.bugun },
          { anahtar: 'urun', etiket: 'Ürün', ipucu: 'Örn. pullu, şort etek, keten etek' },
          { anahtar: 'adet', etiket: 'Adet', tip: 'number' },
          { anahtar: 'fiyat', etiket: 'Birim fiyat (₺)', tip: 'number' }
        ]
      };
    },

    odemeler: function () {
      return {
        tablo: 'odemeler',
        baslik: 'Cari defterinden ödemeler',
        aciklama: 'Bircan Abi\'ye banka dışında (elden / nakit) yapılan ödemeler. ' +
                  'Bankadan yapılanlar aşağıda ayrı listelenir.',
        satirlar: function () { return H().odemeler().slice().reverse(); },
        yon: function () { return 'gider'; },
        kolonlar: [
          { etiket: 'Tarih', anahtar: 't', hucre: function (r) { return F.tarih(r.t); }, ham: function (r) { return F.tarih(r.t); } },
          { etiket: 'Ödediğimiz', anahtar: 'tutar', sag: true, hucre: function (r) { return '<span class="azalan">−' + F.para(r.tutar) + '</span>'; }, ham: function (r) { return r.tutar; } }
        ],
        mobilBaslik: function () { return 'Bircan Abi\'ye ödeme'; },
        mobilAlt: function (r) {
          return '<span>' + F.tarih(r.t) + '</span><span>cari defteri</span>' +
            (r.ekleyen ? '<span>' + kacir(r.ekleyen) + '</span>' : '');
        },
        mobilTutar: function (r) { return '<span class="azalan">−' + F.para(r.tutar) + '</span>'; },
        toplamlar: function (liste) {
          return {
            etiket: 'TOPLAM (' + liste.length + ' ödeme)',
            deger: '<span class="azalan">−' + F.para(liste.reduce(function (t, r) { return t + (+r.tutar || 0); }, 0)) + '</span>'
          };
        },
        alanlar: [
          { anahtar: 't', etiket: 'Ödeme tarihi', tip: 'date', varsayilan: U.bugun },
          { anahtar: 'tutar', etiket: 'Ödediğimiz tutar (₺)', tip: 'number', ipucu: 'Pozitif yazın; bu zaten bir para çıkışıdır. Bankadan ödediyseniz Giderler sayfasına yazın.' }
        ]
      };
    },

    /** Bankadan Bircan'a giden odemeler — kaynagi Kasa oldugu icin salt okunur. */
    bankaOdemeleri: function () {
      return {
        tablo: 'kasa',
        baslik: 'Bankadan Bircan Abi\'ye ödemeler',
        aciklama: 'Banka hesabından doğrudan ona gönderilenler. Bu satırlar Giderler ' +
                  'sayfasından düzenlenir; borcumuzdan da düşülür.',
        satirlar: function () { return H().bankadanOdemeler().slice().reverse(); },
        yon: function () { return 'gider'; },
        duzenle: false,
        kolonlar: [
          { etiket: 'Tarih', anahtar: 't', hucre: function (r) { return F.tarih(r.t); }, ham: function (r) { return F.tarih(r.t); } },
          { etiket: 'Açıklama', anahtar: 'aciklama' },
          { etiket: 'Ödediğimiz', anahtar: 'tutar', sag: true, hucre: function (r) { return '<span class="azalan">−' + F.para(r.tutar) + '</span>'; }, ham: function (r) { return r.tutar; } }
        ],
        mobilBaslik: function (r) { return kacir(r.aciklama); },
        mobilAlt: function (r) { return '<span>' + F.tarih(r.t) + '</span><span>banka hesabı</span>'; },
        mobilTutar: function (r) { return '<span class="azalan">−' + F.para(r.tutar) + '</span>'; },
        toplamlar: function (liste) {
          return {
            etiket: 'TOPLAM (' + liste.length + ' ödeme)',
            deger: '<span class="azalan">−' + F.para(liste.reduce(function (t, r) { return t + (+r.tutar || 0); }, 0)) + '</span>'
          };
        },
        alanlar: []
      };
    },

    kasa: function (suzgec) {
      return {
        tablo: 'kasa',
        baslik: suzgec === 'Gelir' ? 'Gelir kayıtları'
              : suzgec === 'Gider' ? 'Gider kayıtları' : 'Tüm kasa hareketleri',
        aciklama: suzgec === 'Gelir' ? 'Banka hesabına giren tutarlar.'
                : suzgec === 'Gider' ? 'Banka hesabından çıkan tutarlar.'
                : 'Gelir ve gider hareketlerinin tamamı.',
        satirlar: function () {
          var liste = H().kasa();
          if (suzgec) liste = liste.filter(function (r) { return r.tur === suzgec; });
          return liste.reverse();
        },
        yon: function (r) { return r.tur === 'Gelir' ? 'gelir' : 'gider'; },
        kolonlar: [
          { etiket: 'Tarih', anahtar: 't', hucre: function (r) { return F.tarih(r.t); }, ham: function (r) { return F.tarih(r.t); } },
          { etiket: 'Açıklama', anahtar: 'aciklama' },
          { etiket: 'Tür', anahtar: 'tur' },
          {
            etiket: 'Tutar', anahtar: 'tutar', sag: true,
            hucre: function (r) {
              return r.tur === 'Gelir'
                ? '<span class="artan">+' + F.para(r.tutar) + '</span>'
                : '<span class="azalan">−' + F.para(r.tutar) + '</span>';
            },
            ham: function (r) { return (r.tur === 'Gelir' ? '' : '-') + r.tutar; }
          }
        ],
        mobilBaslik: function (r) { return kacir(r.aciklama); },
        mobilAlt: function (r) {
          return '<span>' + F.tarih(r.t) + '</span><span>' + r.tur + '</span>' +
            (r.ekleyen ? '<span>' + kacir(r.ekleyen) + '</span>' : '');
        },
        mobilTutar: function (r) {
          return r.tur === 'Gelir'
            ? '<span class="artan">+' + F.para(r.tutar) + '</span>'
            : '<span class="azalan">−' + F.para(r.tutar) + '</span>';
        },
        toplamlar: function (liste) {
          var g = liste.filter(function (r) { return r.tur === 'Gelir'; })
            .reduce(function (t, r) { return t + +r.tutar; }, 0);
          var d = liste.filter(function (r) { return r.tur === 'Gider'; })
            .reduce(function (t, r) { return t + +r.tutar; }, 0);
          if (suzgec === 'Gelir') return { etiket: 'TOPLAM GELİR (' + liste.length + ')', deger: '<span class="artan">+' + F.para(g) + '</span>' };
          if (suzgec === 'Gider') return { etiket: 'TOPLAM GİDER (' + liste.length + ')', deger: '<span class="azalan">−' + F.para(d) + '</span>' };
          return { etiket: 'NET (' + liste.length + ' hareket)', deger: F.paraIsaretli(g - d) };
        },
        alanlar: [
          { anahtar: 't', etiket: 'Tarih', tip: 'date', varsayilan: U.bugun },
          { anahtar: 'aciklama', etiket: 'Açıklama', ipucu: 'Nereden geldi / nereye gitti' },
          { anahtar: 'tur', etiket: 'Tür', tip: 'secim', secenekler: ['Gelir', 'Gider'], varsayilan: suzgec || 'Gider' },
          { anahtar: 'tutar', etiket: 'Tutar (₺)', tip: 'number', ipucu: 'Her zaman pozitif yazın; artı mı eksi mi olduğunu Tür belirler.' }
        ]
      };
    }
  };

  /** defter() cagrisini Depo'ya baglar. */
  function defterKur(cfg) {
    return U.defter(Object.assign({}, cfg, {
      ekle: function (tazele) {
        U.form(cfg, null, function (kayit) {
          return kok.Depo.ekle(cfg.tablo, kayit).then(function () { kok.App.ciz(); });
        });
      },
      duzenleyici: function (id, tazele) {
        var kayit = kok.Depo.bul(cfg.tablo, id);
        if (!kayit) return U.bildir('Kayıt bulunamadı.', true);
        U.form(cfg, kayit, function (yeni) {
          return kok.Depo.guncelle(cfg.tablo, Object.assign({ id: id }, yeni))
            .then(function () { kok.App.ciz(); });
        });
      },
      silici: function (id, tazele) {
        var kayit = cfg.satirlar().filter(function (r) { return r.id === id; })[0]
          || kok.Depo.bul(cfg.tablo, id);
        if (!kayit) return U.bildir('Kayıt bulunamadı.', true);
        U.silOnay(cfg, kayit, function () {
          return kok.Depo.sil(cfg.tablo, id).then(function () { kok.App.ciz(); });
        });
      }
    }));
  }

  /* ============================================================
     SAYFALAR
     ============================================================ */
  var Gorunum = {

    /* ---------------- ÖZET ---------------- */
    ozet: function () {
      var h = H(), b = h.banka(), c = h.cari(), s = h.cumleler();
      var gunluk = h.gunlukKasa();
      var kasaEgri = h.kasaEgrisi();

      var v = el('<div>' +
        cumle(s.kasa) +

        '<div class="hero">' +
          '<div class="etiket">Bankadaki net para</div>' +
          '<div class="rakam">' + F.para(b.net) + '</div>' +
          '<div class="not">' + b.k.length + ' hareket · ' + F.para(b.gelir) + ' girdi, ' +
            F.para(b.gider) + ' çıktı</div>' +
        '</div>' +

        '<div class="izgara dort">' +
          kutu('Toplam gelir', '<span class="artan">' + F.para(b.gelir) + '</span>',
               b.gelirler.length + ' tahsilat', 'gelir') +
          kutu('Toplam gider', '<span class="azalan">' + F.para(b.gider) + '</span>',
               b.giderler.length + ' harcama', 'gider') +
          kutu('Bircan Abi\'ye borcumuz', F.para(c.kalan),
               c.kalan === 0 ? 'kapandı' : F.para(c.odenen) + ' ödendi', 'mavi') +
          kutu('Ondan aldığımız mal', F.para(c.malAlimi), c.sip.length + ' alım satırı') +
        '</div>' +

        '<div id="oz1"></div>' +
        '<div class="ikili"><div id="oz2"></div><div id="oz3"></div></div>' +
      '</div>');

      setTimeout(function () {
        v.querySelector('#oz1').appendChild(grafikKart(
          'Günlük para giriş–çıkışı',
          'Aynı gün içinde bankaya giren (yeşil) ve çıkan (kırmızı) tutarlar.',
          function (g) {
            return U.cizSutun(g, {
              items: gunluk, ciftli: true, yukseklik: 220,
              etiket: 'Günlük gelir ve gider',
              xEtiket: function (d) { return F.tarihKisa(d.k); },
              ipucu: function (d) {
                return '<b>' + F.tarihUzun(d.k) + '</b><br>Giren: ' + F.para(d.gelir) +
                  '<br>Çıkan: ' + F.para(d.gider) + '<br>Net: ' + F.paraIsaretli(d.gelir - d.gider);
              }
            });
          }
        ));

        v.querySelector('#oz2').appendChild(grafikKart(
          'Kasa nasıl gitti',
          'Her hareketten sonra bankada biriken para.',
          function (g) {
            return U.cizCizgi(g, {
              noktalar: kasaEgri, renk: renk('--mavi'), yukseklik: 200,
              etiket: 'Kasa eğrisi',
              xEtiket: function (p) { return F.tarihKisa(p.t); },
              ipucu: function (p) {
                return '<b>' + F.tarihUzun(p.t) + '</b><br>' + kacir(p.etiket) +
                  '<br>Kasa: ' + F.para(p.v);
              }
            });
          }
        ));

        v.querySelector('#oz3').appendChild(grafikKart(
          'Bircan Abi\'ye borcumuz',
          'Her ödemeden sonra kalan borç.',
          function (g) {
            return U.cizCizgi(g, {
              noktalar: h.borcEgrisi(), renk: renk('--kirmizi'), yukseklik: 200,
              etiket: 'Borç eğrisi',
              xEtiket: function (p) { return p.t ? F.tarihKisa(p.t) : ''; },
              ipucu: function (p) {
                return '<b>' + (p.t ? F.tarihUzun(p.t) : '') + '</b><br>' + kacir(p.etiket) +
                  '<br>Kalan borç: ' + F.para(p.v);
              }
            });
          },
          'Devreden açılış mahsubu (' + F.para(c.acilis) + ') başlangıç borcundan düşülmüştür.'
        ));
      }, 0);

      return v;
    },

    /* ---------------- GELİRLER ---------------- */
    gelirler: function () {
      var h = H(), b = h.banka(), s = h.cumleler();
      var kaynaklar = h.grupNorm(b.gelirler, function (r) { return r.aciklama; },
        function (r) { return +r.tutar; }).sort(function (a, c) { return c.v - a.v; });

      var enBuyuk = b.gelirler.length
        ? b.gelirler.reduce(function (a, r) { return +r.tutar > +a.tutar ? r : a; }) : null;

      var v = el('<div>' +
        cumle(s.gelir) +
        '<div class="hero gelir">' +
          '<div class="etiket">Toplam gelir</div>' +
          '<div class="rakam artan">' + F.para(b.gelir) + '</div>' +
          '<div class="not">' + b.gelirler.length + ' tahsilat</div>' +
        '</div>' +
        '<div class="izgara dort">' +
          kutu('Kayıt başına ortalama', F.para(b.gelirler.length ? b.gelir / b.gelirler.length : 0), 'gelir başına') +
          kutu('En büyük giriş', enBuyuk ? F.para(enBuyuk.tutar) : '—', enBuyuk ? F.tarihUzun(enBuyuk.t) : '') +
          kutu('Farklı kaynak', String(kaynaklar.length), 'açıklamaya göre') +
          kutu('Gidere oranı', b.gider ? '%' + (b.gelir / b.gider * 100).toFixed(0) : '—', 'gelir ÷ gider') +
        '</div>' +
        '<div id="ge1"></div><div id="ge2"></div>' +
      '</div>');

      setTimeout(function () {
        v.querySelector('#ge1').appendChild(grafikKart(
          'Para nereden geldi',
          'Açıklamaya göre toplam giriş. Büyük/küçük harf farkları tek kalemde toplanır.',
          function () { return U.yatayListe(kaynaklar, renk('--yesil'), b.gelir); }
        ));
        v.querySelector('#ge2').appendChild(defterKur(CFG.kasa('Gelir')));
      }, 0);

      return v;
    },

    /* ---------------- GİDERLER ---------------- */
    giderler: function () {
      var h = H(), b = h.banka(), s = h.cumleler();
      var grup = function (liste) {
        return h.grupNorm(liste, function (r) { return r.aciklama; }, function (r) { return +r.tutar; })
          .sort(function (a, c) { return c.v - a.v; });
      };
      var bircanOdeme = grup(b.giderBircanOdemeKayit);
      var bircanIs = grup(b.giderBircanIsKayit);
      var diger = grup(b.giderDigerKayit);
      var gd = b.giderler;

      var v = el('<div>' +
        cumle(s.gider) +
        '<div class="hero gider">' +
          '<div class="etiket">Bankadan çıkan toplam para</div>' +
          '<div class="rakam azalan">' + F.para(b.gider) + '</div>' +
          '<div class="not">' + b.giderler.length + ' harcama</div>' +
        '</div>' +

        '<div class="serit">' +
          '<b>Bircan Abi\'ye yapılan ödemeler de burada görünür</b>, çünkü para gerçekten ' +
          'bankadan çıkmıştır. Aynı ödemeler Cari Hesap sayfasında <b>borcumuzu düşürür</b>. ' +
          'Bu çift sayma değildir: bir kez para çıkışı, bir kez borç azalması.' +
        '</div>' +

        '<div class="izgara dort">' +
          kutu('Bircan Abi\'ye mal borcu ödemesi', '<span class="azalan">' + F.para(b.giderBircanOdeme) + '</span>',
               b.giderBircanOdemeKayit.length + ' kayıt · ' + F.yuzde(b.giderBircanOdeme, b.gider) + ' pay', 'gider') +
          kutu('Bircan işi masrafı', '<span class="azalan">' + F.para(b.giderBircanIs) + '</span>',
               b.giderBircanIsKayit.length + ' kayıt · ' + F.yuzde(b.giderBircanIs, b.gider) + ' pay', 'gider') +
          kutu('Diğer işletme gideri', '<span class="azalan">' + F.para(b.giderDiger) + '</span>',
               b.giderDigerKayit.length + ' kayıt · ' + F.yuzde(b.giderDiger, b.gider) + ' pay', 'gider') +
          kutu('En büyük çıkış', F.para(Math.max.apply(null, gd.map(function (r) { return +r.tutar; }).concat([0]))),
               gd.length ? F.tarihUzun(gd.reduce(function (a, r) { return +r.tutar > +a.tutar ? r : a; }).t) : '') +
        '</div>' +

        '<div id="gi1"></div><div id="gi2"></div><div id="gi3"></div><div id="gi4"></div>' +
      '</div>');

      setTimeout(function () {
        v.querySelector('#gi1').appendChild(grafikKart(
          'Bircan Abi\'ye mal borcu ödemesi — ' + F.para(b.giderBircanOdeme),
          'Doğrudan ona gönderilen para. Bu tutar cari hesaptaki borcumuzdan düşülür.',
          function () { return U.yatayListe(bircanOdeme, renk('--kirmizi'), b.giderBircanOdeme); },
          '“Nereye Gitti” hanesinde doğrudan Bircan yazan kayıtlar — “BIRCAN” ve “Bircan” aynı sayılır.'
        ));
        v.querySelector('#gi2').appendChild(grafikKart(
          'Bircan işi masrafı — ' + F.para(b.giderBircanIs),
          'Bircan işi için başkalarına ödenen işçilik ve masraflar.',
          function () { return U.yatayListe(bircanIs, renk('--kirmizi'), b.giderBircanIs); },
          'Köşeli parantezli kayıtlar (ör. “SİNAN ERASLAN [BİRCAN]”) buraya düşer: para Bircan\'a değil, ' +
          'o kişiye gitmiştir. Bu yüzden borcumuzu düşürmez.'
        ));
        v.querySelector('#gi3').appendChild(grafikKart(
          'Diğer işletme giderleri — ' + F.para(b.giderDiger),
          'Bircan işiyle ilgisi olmayan tüm harcamalar, büyükten küçüğe.',
          function () { return U.yatayListe(diger, renk('--kirmizi'), b.giderDiger); }
        ));
        v.querySelector('#gi4').appendChild(defterKur(CFG.kasa('Gider')));
      }, 0);

      return v;
    },

    /* ---------------- CARİ HESAP ---------------- */
    cari: function () {
      var h = H(), c = h.cari(), s = h.cumleler();

      var v = el('<div>' +
        cumle(s.cari) +
        '<div class="hero">' +
          '<div class="etiket">Bircan Abi\'ye kalan borcumuz</div>' +
          '<div class="rakam">' + F.para(c.kalan) + '</div>' +
          '<div class="not">' + F.para(c.malAlimi) + ' mal alındı · ' + F.para(c.odenen) + ' ödendi</div>' +
        '</div>' +

        '<div class="serit">' +
          'Bircan Abi <b>tedarikçidir</b>: ondan mal alırız, ona para öderiz. ' +
          'Buradaki tutarlar gelir değil, <b>maliyet ve para çıkışıdır</b>. ' +
          'Kalan bakiye <b>bizim ona borcumuzdur</b>.' +
        '</div>' +

        '<div class="izgara dort">' +
          kutu('Ondan aldığımız mal', F.para(c.malAlimi), c.sip.length + ' alım satırı', 'mavi') +
          kutu('Bankadan ödediğimiz', '<span class="azalan">' + F.para(c.odenenBanka) + '</span>',
               c.odBanka.length + ' ödeme', 'gider') +
          kutu('Cari defterinden ödediğimiz', '<span class="azalan">' + F.para(c.odenenCari) + '</span>',
               c.od.length + ' ödeme', 'gider') +
          kutu('Toplam ödenen', '<span class="azalan">' + F.para(c.odenen) + '</span>',
               F.yuzde(c.odenen, c.malAlimi) + ' tamamlandı') +
        '</div>' +

        '<div id="ca1"></div><div id="ca2"></div><div id="ca3"></div><div id="ca4"></div>' +
      '</div>');

      setTimeout(function () {
        v.querySelector('#ca1').appendChild(grafikKart(
          'Borcumuz nasıl azaldı',
          'Her ödemeden sonra Bircan Abi\'ye kalan borcumuz. Banka ve cari ödemelerinin ikisi de sayılır.',
          function (g) {
            return U.cizCizgi(g, {
              noktalar: h.borcEgrisi(), renk: renk('--kirmizi'), yukseklik: 220,
              etiket: 'Borç eğrisi',
              xEtiket: function (p) { return p.t ? F.tarihKisa(p.t) : ''; },
              ipucu: function (p) {
                return '<b>' + (p.t ? F.tarihUzun(p.t) : '') + '</b><br>' + kacir(p.etiket) +
                  '<br>Kalan borç: ' + F.para(p.v);
              }
            });
          }
        ));
        v.querySelector('#ca2').appendChild(defterKur(CFG.siparisler()));
        v.querySelector('#ca3').appendChild(defterKur(CFG.odemeler()));
        v.querySelector('#ca4').appendChild(U.defter(Object.assign({}, CFG.bankaOdemeleri(), {
          duzenleyici: function () {}, silici: function () {}
        })));
      }, 0);

      return v;
    },

    /* ---------------- MAL ALIM ANALİZİ ---------------- */
    urunler: function () {
      var h = H(), c = h.cari(), s = h.cumleler();
      var urun = h.grupNorm(c.sip, function (r) { return r.urun; }, function (r) { return r.toplam; })
        .sort(function (a, b) { return b.v - a.v; });
      var adetler = {};
      h.grupNorm(c.sip, function (r) { return r.urun; }, function (r) { return +r.adet || 0; })
        .forEach(function (d) { adetler[d.k] = d.v; });
      var aylik = h.aylikMalAlimi();
      var toplamAdet = c.sip.reduce(function (t, r) { return t + (+r.adet || 0); }, 0);

      var v = el('<div>' +
        cumle(s.malAlimi) +
        '<div class="serit">' +
          'Bu sayfa Bircan Abi\'den <b>aldığımız</b> malları gösterir — satış değil, <b>maliyet</b> tarafıdır.' +
        '</div>' +
        '<div class="izgara dort">' +
          kutu('Toplam mal alımı', F.para(c.malAlimi), c.sip.length + ' alım satırı', 'mavi') +
          kutu('Ürün çeşidi', String(urun.length), 'farklı ürün adı') +
          kutu('Toplam adet', F.sayi(toplamAdet), 'alınan parça') +
          kutu('Ortalama birim', F.para(toplamAdet ? c.malAlimi / toplamAdet : 0), 'parça başına') +
        '</div>' +
        '<div id="ur1"></div><div id="ur2"></div>' +
      '</div>');

      setTimeout(function () {
        v.querySelector('#ur1').appendChild(grafikKart(
          'Hangi ürüne ne kadar para gitti',
          'Tüm mal alımlarının ürüne göre toplamı, büyükten küçüğe.',
          function () {
            return U.yatayListe(urun.map(function (d) {
              return { k: d.k + '  ·  ' + F.sayi(adetler[d.k] || 0) + ' adet', v: d.v };
            }), renk('--mavi'), c.malAlimi);
          }
        ));
        v.querySelector('#ur2').appendChild(grafikKart(
          'Aylara göre mal alımı',
          'Alım tarihine göre aylık toplam.',
          function (g) {
            return U.cizSutun(g, {
              items: aylik, renk: renk('--mavi'), yukseklik: 220,
              etiket: 'Aylık mal alımı',
              xEtiket: function (d) { return F.ayEtiketKisa(d.k); },
              ipucu: function (d) { return '<b>' + F.ayEtiket(d.k) + '</b><br>' + F.para(d.v); }
            });
          }
        ));
      }, 0);

      return v;
    },

    /* ---------------- AYLIK RAPOR ---------------- */
    rapor: function () {
      var h = H();
      var aylar = h.aylar();
      var secili = kok.App.raporAyi || aylar[0] || F.ayAnahtar(U.bugun());

      var v = el('<div>' +
        '<section class="kart yazdirma-gizle">' +
          '<div class="kart-tepe"><div class="esne"><h2>Aylık rapor</h2>' +
          '<p class="aciklama">Bir ay seçin, sonra “Yazdır / PDF kaydet” deyin. ' +
          'Yazdırma penceresinde hedef olarak “PDF olarak kaydet”i seçebilirsiniz.</p></div></div>' +
          '<div class="kart-govde">' +
            '<div class="alan"><label for="rapor-ay">Ay</label>' +
            '<select id="rapor-ay">' + aylar.map(function (a) {
              return '<option value="' + a + '"' + (a === secili ? ' selected' : '') + '>' + F.ayEtiket(a) + '</option>';
            }).join('') + '</select></div>' +
            '<button class="dg ana" data-yazdir>Yazdır / PDF kaydet</button>' +
          '</div>' +
        '</section>' +
        '<div id="rapor-govde"></div>' +
      '</div>');

      function cizRapor() {
        var k = h.ayKesiti(secili);
        var kap = v.querySelector('#rapor-govde');
        kap.innerHTML = '';

        kap.appendChild(el(
          '<div class="baski-baslik" style="margin-bottom:14px">' +
            '<div style="font-family:var(--display);font-weight:700;font-size:19px">Slaw Rezz — ' +
              F.ayEtiket(secili) + ' raporu</div>' +
            '<div style="font-size:11px;color:var(--murekkep-3)">Hazırlandı: ' + F.tarih(U.bugun()) + '</div>' +
          '</div>'
        ));

        kap.appendChild(el('<div class="hero">' +
          '<div class="etiket">' + F.ayEtiket(secili) + ' · bankada net</div>' +
          '<div class="rakam">' + F.paraIsaretli(k.net) + '</div>' +
          '<div class="not">' + F.para(k.gelir) + ' girdi, ' + F.para(k.gider) + ' çıktı · ' +
            k.kasa.length + ' hareket</div>' +
        '</div>'));

        kap.appendChild(el('<div class="izgara dort">' +
          kutu('Gelir', '<span class="artan">' + F.para(k.gelir) + '</span>', k.gelirler.length + ' kayıt', 'gelir') +
          kutu('Gider', '<span class="azalan">' + F.para(k.gider) + '</span>', k.giderler.length + ' kayıt', 'gider') +
          kutu('Bircan\'dan mal alımı', F.para(k.malAlimi), k.sip.length + ' satır', 'mavi') +
          kutu('Bircan\'a ödenen', F.para(k.odenen), k.od.length + ' ödeme') +
        '</div>'));

        if (!k.kasa.length && !k.sip.length && !k.od.length) {
          kap.appendChild(el('<div class="serit">Bu ayda hiç kayıt yok.</div>'));
          return;
        }

        var cfgK = CFG.kasa();
        kap.appendChild(U.defter(Object.assign({}, cfgK, {
          baslik: F.ayEtiket(secili) + ' — kasa hareketleri',
          aciklama: '',
          satirlar: function () { return k.kasa.slice().reverse(); },
          duzenle: false,
          ekle: null,
          duzenleyici: function () {}, silici: function () {}
        })));

        if (k.sip.length) {
          var cfgS = CFG.siparisler();
          kap.appendChild(U.defter(Object.assign({}, cfgS, {
            baslik: F.ayEtiket(secili) + ' — Bircan Abi\'den mal alımları',
            aciklama: '',
            satirlar: function () { return k.sip.slice().reverse(); },
            duzenle: false, ekle: null,
            duzenleyici: function () {}, silici: function () {}
          })));
        }
      }

      setTimeout(cizRapor, 0);
      v.querySelector('#rapor-ay').onchange = function (e) {
        secili = e.target.value;
        kok.App.raporAyi = secili;
        cizRapor();
      };
      v.querySelector('[data-yazdir]').onclick = function () { window.print(); };

      return v;
    },

    /* ---------------- AYARLAR ---------------- */
    ayarlar: function () {
      var h = H(), c = h.cari();
      var durum = kok.Depo.durum();

      var v = el('<div>' +
        '<section class="kart">' +
          '<div class="kart-tepe"><div class="esne"><h2>Bağlantı</h2>' +
          '<p class="aciklama">Veriler Google E-Tablolar\'da tutulur. Telefonda ve bilgisayarda aynı tabloyu görürsünüz.</p></div></div>' +
          '<div class="kart-govde">' +
            '<div class="kd">' +
              '<div class="k">Durum</div><div class="d">' + durum.metin + '</div>' +
              '<div class="k">Kullanıcı</div><div class="d">' + kacir(kok.SRApi.Api.kullanici || '—') + '</div>' +
              '<div class="k">Bekleyen kayıt</div><div class="d">' + durum.bekleyen + '</div>' +
              '<div class="k">Son yedek</div><div class="d">' + kacir(durum.sonYedek || 'henüz alınmadı') + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:14px">' +
              '<button class="dg" data-yenile>Verileri yenile</button>' +
              '<button class="dg" data-yedek>Şimdi yedek al</button>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section class="kart">' +
          '<div class="kart-tepe"><div class="esne"><h2>Açılış mahsubu</h2>' +
          '<p class="aciklama">Bircan Abi ile önceki dönemden devreden ve borçtan düşülen tutar. ' +
          'Şu an <b>0 ₺</b> olmalı: devreden bakiye, cari hesapta “eski bakiye” adlı normal bir ' +
          'alım satırı olarak duruyor. İki yerde birden sayılmaması için burayı 0 bırakın.</p></div></div>' +
          '<div class="kart-govde">' +
            '<div class="alan"><label for="acilis">Açılış mahsubu (₺)</label>' +
            '<input id="acilis" type="number" step="any" inputmode="decimal" value="' + c.acilis + '">' +
            '<div class="ipucu">Şu an: ' + F.para(c.acilis) + '. Değiştirirseniz kalan borç yeniden hesaplanır.</div></div>' +
            '<button class="dg ana" data-acilis-kaydet>Kaydet</button>' +
          '</div>' +
        '</section>' +

        '<section class="kart">' +
          '<div class="kart-tepe"><div class="esne"><h2>Veriyi dışa aktar</h2>' +
          '<p class="aciklama">Üç tablonun tamamını bilgisayarınıza indirir. Excel bu dosyaları doğrudan açar.</p></div></div>' +
          '<div class="kart-govde" style="display:flex;gap:9px;flex-wrap:wrap">' +
            '<button class="dg" data-csv="kasa">Kasa CSV</button>' +
            '<button class="dg" data-csv="siparisler">Mal alımları CSV</button>' +
            '<button class="dg" data-csv="odemeler">Ödemeler CSV</button>' +
            '<button class="dg" data-json>Tümü (JSON)</button>' +
          '</div>' +
        '</section>' +

        '<section class="kart">' +
          '<div class="kart-tepe"><div class="esne"><h2>Kayıt sayıları</h2></div></div>' +
          '<div class="kart-govde"><div class="kd">' +
            '<div class="k">Mal alımı</div><div class="d">' + c.sip.length + '</div>' +
            '<div class="k">Ödeme</div><div class="d">' + c.od.length + '</div>' +
            '<div class="k">Kasa hareketi</div><div class="d">' + h.kasa().length + '</div>' +
          '</div></div>' +
        '</section>' +

        '<section class="kart">' +
          '<div class="kart-tepe"><div class="esne"><h2>Oturum</h2></div></div>' +
          '<div class="kart-govde">' +
            '<button class="dg tehlike" data-cikis>Çıkış yap</button>' +
          '</div>' +
        '</section>' +
      '</div>');

      v.querySelector('[data-yenile]').onclick = function () {
        kok.Depo.tazele(true).then(function () { U.bildir('Veriler yenilendi.'); kok.App.ciz(); });
      };
      v.querySelector('[data-yedek]').onclick = function (e) {
        var b = e.currentTarget;
        b.disabled = true;
        b.innerHTML = '<span class="donuyor"></span> Yedekleniyor';
        kok.SRApi.Api.cagir('yedekle').then(function (cev) {
          U.bildir('Yedek alındı: ' + cev.yedek.kayit + ' kayıt.');
          kok.App.ciz();
        }).catch(function (hata) {
          b.disabled = false;
          b.textContent = 'Şimdi yedek al';
          U.bildir(hata.message, true);
        });
      };
      v.querySelector('[data-acilis-kaydet]').onclick = function () {
        var d = parseFloat(String(v.querySelector('#acilis').value).replace(',', '.'));
        if (!isFinite(d) || d < 0) return U.bildir('Açılış mahsubu sıfır veya daha büyük bir sayı olmalı.', true);
        kok.Depo.ayarYaz('acilis_bakiye', d).then(function () {
          U.bildir('Açılış mahsubu güncellendi.');
          kok.App.ciz();
        }).catch(function (hata) { U.bildir(hata.message, true); });
      };
      v.querySelectorAll('[data-csv]').forEach(function (b) {
        b.onclick = function () {
          var hangi = b.getAttribute('data-csv');
          var cfg = hangi === 'kasa' ? CFG.kasa()
                  : hangi === 'siparisler' ? CFG.siparisler() : CFG.odemeler();
          var basliklar = cfg.kolonlar.map(function (k) { return k.etiket; });
          var satirlar = cfg.satirlar().map(function (r) {
            return cfg.kolonlar.map(function (k) { return k.ham ? k.ham(r) : (r[k.anahtar] || ''); });
          });
          U.csvIndir([basliklar].concat(satirlar), 'slawrezz-' + hangi);
        };
      });
      v.querySelector('[data-json]').onclick = function () {
        var a = document.createElement('a');
        var url = URL.createObjectURL(new Blob(
          [JSON.stringify(kok.Depo.veri, null, 1)], { type: 'application/json' }));
        a.href = url;
        a.download = 'slawrezz-veri-' + U.bugun() + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      };
      v.querySelector('[data-cikis]').onclick = function () { kok.App.cikis(); };

      return v;
    }
  };

  kok.Gorunum = Gorunum;
  kok.CFG = CFG;
  kok.defterKur = defterKur;

})(typeof globalThis !== 'undefined' ? globalThis : this);
