/* ============================================================
   HESAP  —  Slaw Rezz muhasebe is kurallari
   ------------------------------------------------------------
   Bu dosya TEK dogruluk kaynagidir. Hem tarayici (index.html) hem de
   yerel test (test/dogrula.mjs) ayni kodu calistirir; boylece ekranda
   gorunen rakam ile testin dogruladigi rakam ayni yerden gelir.

   TEMEL KURAL — Bircan Abi TEDARIKCIDIR, musteri degil:
     Siparisler  = ondan aldigimiz mal  = BIZIM MALIYETIMIZ (gelir degil)
     Odemeler    = ona odedigimiz para  = PARA CIKISI (tahsilat degil)
     Kalan       = BIZIM ONA BORCUMUZ

   ONA IKI YOLDAN ODEME YAPILIR:
     1) Cari defterinden (Odemeler sekmesi) — banka disi, elden/nakit
     2) Banka hesabindan — Kasa'da "Nereye Gitti = Bircan" olan gider satirlari
   Ikisi de borcu duser. Ikinci grup ayni zamanda gercek bir banka cikisidir,
   bu yuzden net kasada da gorunur — bu CIFT SAYMA DEGILDIR: bir kez para
   cikisi, bir kez borc azalmasi. "Toplam gider"e yalnizca bir kez girer.

   KOSELI PARANTEZ AYRIMI:
     "SINAN ERASLAN [BIRCAN]" gibi kayitlarda para Bircan'in kendisine degil,
     Bircan isi icin ucuncu kisilere gitmistir. Bunlar borcu DUSURMEZ;
     "Bircan isi masrafi" olarak ayri gosterilir.
   ============================================================ */
(function (kok) {
  'use strict';

  var AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  var TL = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  /* ---------- bicimleyiciler ---------- */
  var F = {
    ayAdlari: AYLAR,
    sayi: function (v) { return TL.format(Math.round(v || 0)); },
    para: function (v) { return TL.format(Math.round(v || 0)) + ' ₺'; },
    /* isaretli tutar: gelir +, gider − (eksi isareti U+2212, tire degil) */
    paraIsaretli: function (v) {
      var m = TL.format(Math.round(Math.abs(v || 0))) + ' ₺';
      if (v > 0) return '+' + m;
      if (v < 0) return '−' + m;
      return m;
    },
    kisa: function (v) {
      var a = Math.abs(v || 0);
      if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace('.', ',') + ' Mn';
      if (a >= 1e3) return Math.round(v / 1e3) + ' B';
      return TL.format(v || 0);
    },
    tarih: function (s) {
      if (!s) return '';
      var p = String(s).split('-');
      return p[2] + '.' + p[1] + '.' + p[0];
    },
    tarihUzun: function (s) {
      if (!s) return '';
      var p = String(s).split('-');
      return (+p[2]) + ' ' + AYLAR[(+p[1]) - 1] + ' ' + p[0];
    },
    tarihKisa: function (s) {
      if (!s) return '';
      var p = String(s).split('-');
      return (+p[2]) + ' ' + AYLAR[(+p[1]) - 1].slice(0, 3);
    },
    ayAnahtar: function (s) { return String(s || '').slice(0, 7); },
    ayEtiket: function (k) {
      var p = String(k).split('-');
      return AYLAR[(+p[1]) - 1] + ' ' + p[0];
    },
    ayEtiketKisa: function (k) {
      var p = String(k).split('-');
      return AYLAR[(+p[1]) - 1].slice(0, 3) + ' ' + p[0].slice(2);
    },
    yuzde: function (pay, tum) {
      if (!tum) return '%0';
      return '%' + (pay / tum * 100).toFixed(1).replace('.', ',');
    }
  };

  /* ---------- Turkce anahtar normalizasyonu ----------
     "BIRCAN".toLowerCase('tr') noktasiz 'bırcan' uretir ve eslesme kacar.
     Bu yuzden karsilastirmadan ONCE I / İ / ı / i harflerinin hepsi 'i'ye
     indirgenir, sonra kucultulur. Boylece "BIRCAN" ile "Bircan" ayni kisidir. */
  function normAnahtar(s) {
    return String(s == null ? '' : s)
      .trim()
      .replace(/[İIıi]/g, 'i')
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function topla(liste, sec) {
    return liste.reduce(function (t, r) { return t + (+sec(r) || 0); }, 0);
  }

  /* ---------- yazim hatasi toleransi ----------
     Iki kelime arasindaki duzenleme uzakligi (Levenshtein). "trenyol" ile
     "trendyol" arasindaki fark 1'dir; boyle kucuk hatalar ayni kelime sayilir. */
  function uzaklik(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    var onceki = [];
    for (var j = 0; j <= b.length; j++) onceki[j] = j;

    for (var i = 1; i <= a.length; i++) {
      var simdiki = [i];
      for (var k = 1; k <= b.length; k++) {
        simdiki[k] = Math.min(
          onceki[k] + 1,                                              /* silme  */
          simdiki[k - 1] + 1,                                         /* ekleme */
          onceki[k - 1] + (a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1) /* degis */
        );
      }
      onceki = simdiki;
    }
    return onceki[b.length];
  }

  /**
   * Aciklamada "Trendyol" gecip gecmedigini yazim hatalarina ragmen anlar.
   * Gercek veride su yazimlarin hepsi ayni odemedir:
   *   TRENDYOL · TRENYOL · TREDYOL · Terendyol · TRENDYOL ÖDE
   */
  function trendyolMu(metin) {
    var kelimeler = normAnahtar(metin).split(/[^a-z0-9çğıöşü]+/);
    for (var i = 0; i < kelimeler.length; i++) {
      var k = kelimeler[i];
      if (k.length < 6) continue;
      if (uzaklik(k, 'trendyol') <= 2) return true;
    }
    return false;
  }

  function tariheGore(a, b) { return String(a.t).localeCompare(String(b.t)); }

  /* ============================================================
     Hesap(veri)  ->  tum turetilmis rakamlar
     veri = { acilis, siparisler[], odemeler[], kasa[] }
     ============================================================ */
  function Hesap(veri) {
    if (!(this instanceof Hesap)) return new Hesap(veri);
    this.veri = veri || { acilis: 0, siparisler: [], odemeler: [], kasa: [] };
  }

  Hesap.prototype = {

    /* --- ham listeler, tarihe gore sirali --- */
    siparisler: function () {
      return (this.veri.siparisler || []).map(function (r) {
        return Object.assign({}, r, { toplam: (+r.adet || 0) * (+r.fiyat || 0) });
      }).sort(tariheGore);
    },
    odemeler: function () { return (this.veri.odemeler || []).slice().sort(tariheGore); },
    kasa: function () { return (this.veri.kasa || []).slice().sort(tariheGore); },

    trendyolMu: function (aciklama) { return trendyolMu(aciklama); },

    /**
     * Gelir kaynaklarini gruplar.
     *
     * "TRENDYOL" kelimesinin yazim hatalari (TRENYOL, TREDYOL, Terendyol,
     * TRENDYOL ÖDE) ayni sey sayilir — AMA odemeyi kimin aldigi korunur:
     *   "SLAW REZZ - TRENDYOL ÖDEME"  ve  "SLAWREZZ - TRENYOL ÖDEME"  → ayni
     *   "Dummy - TREDYOL ÖDEME"       ve  "Dummy - Terendyol ödeme"   → ayni
     *   ama SLAW REZZ ile Dummy AYRI KALIR, cunku ayri hesaplardir.
     *
     * Ham tabloda aciklamalar yazildigi gibi durur; birlestirme yalnizca
     * bu ozet listesindedir.
     */
    gelirKaynaklari: function () {
      var self = this;
      var m = new Map();

      this.banka().gelirler.forEach(function (r) {
        var ham = String(r.aciklama || '').trim();
        var anahtar, etiket;

        if (self.trendyolMu(ham)) {
          /* Aciklama "KIM - NE" bicimindedir; kimi koruyup neyi sabitliyoruz.
             "SLAW REZZ" ile "SLAWREZZ" ayni sayilsin diye anahtardan
             bosluklar da atilir. */
          var onEk = ham.split(/\s+-\s+/)[0].trim();
          anahtar = 'trendyol|' + normAnahtar(onEk).replace(/\s+/g, '');
          etiket = (onEk || 'Trendyol') + ' — Trendyol ödemesi';
        } else {
          anahtar = 'diger|' + normAnahtar(ham);
          etiket = ham;
        }

        if (!m.has(anahtar)) m.set(anahtar, { k: etiket, v: 0, adet: 0 });
        var o = m.get(anahtar);
        o.v += (+r.tutar || 0);
        o.adet++;
      });

      return Array.from(m.values()).sort(function (a, b) { return b.v - a.v; });
    },

    /* --- Bircan ile ilgili kayit siniflandirmasi --- */

    /** Aciklamada herhangi bir sekilde "Bircan" geciyor mu? */
    bircanMi: function (aciklama) { return normAnahtar(aciklama).indexOf('bircan') >= 0; },

    /** Dogrudan Bircan'in kendisine yapilan odeme — BORCU DUSER.
        Koseli parantezliler ucuncu kisiye gitmistir, buraya girmez. */
    bircanaOdemeMi: function (aciklama) {
      return this.bircanMi(aciklama) && String(aciklama || '').indexOf('[') < 0;
    },

    /** Bircan isi icin ucuncu kisiye odenen masraf — borcu DUSURMEZ. */
    bircanIsMasrafiMi: function (aciklama) {
      return this.bircanMi(aciklama) && String(aciklama || '').indexOf('[') >= 0;
    },

    /** Kasa'dan Bircan'a dogrudan giden odemeler (borc kapatan banka cikislari) */
    bankadanOdemeler: function () {
      var self = this;
      return this.kasa().filter(function (r) {
        return r.tur === 'Gider' && self.bircanaOdemeMi(r.aciklama);
      });
    },

    /* --- Bircan Abi cari hesabi (tedarikci) --- */
    cari: function () {
      var sip = this.siparisler();
      var odCari = this.odemeler();               /* cari defterinden, banka disi */
      var odBanka = this.bankadanOdemeler();      /* banka hesabindan             */

      var malAlimi = topla(sip, function (r) { return r.toplam; });   /* bizim maliyetimiz */
      var acilis = +this.veri.acilis || 0;        /* devreden mahsup (varsa)      */
      var netBorc = malAlimi - acilis;

      var odenenCari = topla(odCari, function (r) { return r.tutar; });
      var odenenBanka = topla(odBanka, function (r) { return r.tutar; });
      var odenen = odenenCari + odenenBanka;

      return {
        sip: sip,
        od: odCari,
        odBanka: odBanka,
        malAlimi: malAlimi,
        acilis: acilis,
        netBorc: netBorc,
        odenenCari: odenenCari,
        odenenBanka: odenenBanka,
        odenen: odenen,
        kalan: netBorc - odenen        /* BIZIM ONA BORCUMUZ */
      };
    },

    /** Iki kaynaktaki odemeler tarih sirasinda birlestirilir. */
    tumOdemeler: function () {
      var cari = this.odemeler().map(function (r) {
        return { t: r.t, tutar: +r.tutar || 0, id: r.id, kaynak: 'cari' };
      });
      var banka = this.bankadanOdemeler().map(function (r) {
        return { t: r.t, tutar: +r.tutar || 0, id: r.id, kaynak: 'banka', aciklama: r.aciklama };
      });
      return cari.concat(banka).sort(tariheGore);
    },

    /* her odemeden sonra Bircan'a kalan borcumuz */
    borcEgrisi: function () {
      var c = this.cari();
      var odemeler = this.tumOdemeler();
      var bakiye = c.netBorc;

      var noktalar = [{
        t: odemeler.length ? odemeler[0].t : (c.sip.length ? c.sip[0].t : null),
        v: bakiye,
        etiket: 'Toplam mal alımı'
      }];
      odemeler.forEach(function (p) {
        bakiye -= p.tutar;
        noktalar.push({
          t: p.t, v: bakiye,
          etiket: (p.kaynak === 'banka' ? 'Bankadan ödeme ' : 'Ödeme ') + F.para(p.tutar)
        });
      });
      return noktalar;
    },

    /* --- banka hesabi (Kasa) --- */
    banka: function () {
      var self = this;
      var k = this.kasa();
      var gelirler = k.filter(function (r) { return r.tur === 'Gelir'; });
      var giderler = k.filter(function (r) { return r.tur === 'Gider'; });

      var bircanOdeme = giderler.filter(function (r) { return self.bircanaOdemeMi(r.aciklama); });
      var bircanIs = giderler.filter(function (r) { return self.bircanIsMasrafiMi(r.aciklama); });
      var diger = giderler.filter(function (r) { return !self.bircanMi(r.aciklama); });

      var T = function (a) { return topla(a, function (r) { return r.tutar; }); };
      return {
        k: k,
        gelirler: gelirler, giderler: giderler,
        giderBircanOdemeKayit: bircanOdeme,
        giderBircanIsKayit: bircanIs,
        giderDigerKayit: diger,
        gelir: T(gelirler),
        gider: T(giderler),
        giderBircanOdeme: T(bircanOdeme),
        giderBircanIs: T(bircanIs),
        giderDiger: T(diger),
        net: T(gelirler) - T(giderler)
      };
    },

    kasaEgrisi: function () {
      var bakiye = 0;
      return this.kasa().map(function (r) {
        bakiye += (r.tur === 'Gelir' ? +r.tutar : -r.tutar);
        return { t: r.t, v: bakiye, etiket: r.aciklama };
      });
    },

    gunlukKasa: function () {
      var m = new Map();
      this.kasa().forEach(function (r) {
        if (!m.has(r.t)) m.set(r.t, { k: r.t, gelir: 0, gider: 0 });
        var o = m.get(r.t);
        if (r.tur === 'Gelir') o.gelir += +r.tutar; else o.gider += +r.tutar;
      });
      return Array.from(m.values()).sort(function (a, b) { return a.k.localeCompare(b.k); });
    },

    /* --- gruplama --- */
    grupla: function (satirlar, anahtarFn, degerFn) {
      var m = new Map();
      satirlar.forEach(function (r) {
        var k = anahtarFn(r);
        if (k === null || k === undefined || k === '') return;
        m.set(k, (m.get(k) || 0) + degerFn(r));
      });
      return Array.from(m.entries()).map(function (e) { return { k: e[0], v: e[1] }; });
    },

    /* Ayni kisinin farkli yazilmis hallerini (Bircan/BIRCAN) tek kalemde toplar;
       gosterilecek etiket olarak ilk karsilasilan ham yazim korunur. */
    grupNorm: function (satirlar, anahtarFn, degerFn) {
      var m = new Map();
      satirlar.forEach(function (r) {
        var ham = String(anahtarFn(r) || '').trim();
        if (!ham) return;
        var nk = normAnahtar(ham);
        if (!m.has(nk)) m.set(nk, { k: ham, v: 0, adet: 0 });
        var o = m.get(nk);
        o.v += degerFn(r);
        o.adet++;
      });
      return Array.from(m.values());
    },

    aylikMalAlimi: function () {
      return this.grupla(this.siparisler(), function (r) { return F.ayAnahtar(r.t); },
        function (r) { return r.toplam; })
        .sort(function (a, b) { return a.k.localeCompare(b.k); });
    },

    /* --- aylik rapor icin tek ayin kesiti --- */
    ayKesiti: function (ayAnahtari) {
      var ay = function (r) { return F.ayAnahtar(r.t) === ayAnahtari; };
      var kasa = this.kasa().filter(ay);
      var sip = this.siparisler().filter(ay);
      var od = this.tumOdemeler().filter(ay);      /* banka + cari, ikisi birlikte */
      var gelirler = kasa.filter(function (r) { return r.tur === 'Gelir'; });
      var giderler = kasa.filter(function (r) { return r.tur === 'Gider'; });
      var T = function (a) { return topla(a, function (r) { return r.tutar; }); };
      return {
        ay: ayAnahtari,
        kasa: kasa, gelirler: gelirler, giderler: giderler,
        sip: sip, od: od,
        gelir: T(gelirler), gider: T(giderler), net: T(gelirler) - T(giderler),
        malAlimi: topla(sip, function (r) { return r.toplam; }),
        odenen: T(od)
      };
    },

    /* veride gecen tum aylar, yeniden eskiye */
    aylar: function () {
      var s = new Set();
      this.kasa().forEach(function (r) { s.add(F.ayAnahtar(r.t)); });
      this.siparisler().forEach(function (r) { s.add(F.ayAnahtar(r.t)); });
      this.odemeler().forEach(function (r) { s.add(F.ayAnahtar(r.t)); });
      return Array.from(s).filter(Boolean).sort().reverse();
    },

    /* ============================================================
       DUZ TURKCE OZETLER
       Rakamin ne anlama geldigini bir cumleyle soyler. Sabit metin degil,
       verinin durumuna gore uretilir.
       ============================================================ */
    cumleler: function () {
      var b = this.banka(), c = this.cari();
      var s = {};

      s.kasa = b.net > 0
        ? 'Bankada ' + F.para(b.net) + ' var. Bugüne kadar ' + F.para(b.gelir) +
          ' girdi, ' + F.para(b.gider) + ' çıktı.'
        : b.net === 0
          ? 'Banka hesabı sıfırlanmış: giren para ile çıkan para eşit.'
          : 'Dikkat: banka hesabı ' + F.para(Math.abs(b.net)) + ' ekside görünüyor. ' +
            'Kayıtlarda eksik bir gelir olabilir.';

      var odemeKirilimi = (c.odenenBanka && c.odenenCari)
        ? ' Ödemenin ' + F.para(c.odenenBanka) + '’si banka hesabından, ' +
          F.para(c.odenenCari) + '’si cari defterinden yapıldı.'
        : c.odenenBanka ? ' Ödemelerin tamamı banka hesabından yapıldı.' : '';

      if (c.kalan === 0) {
        s.cari = 'Bircan Abi\'ye borcumuz kalmadı — aldığımız malın tamamının parası ödendi.' +
          odemeKirilimi;
      } else if (c.kalan > 0) {
        s.cari = 'Bircan Abi\'ye ' + F.para(c.kalan) + ' borcumuz var. Ondan ' +
          F.para(c.malAlimi) + ' mal aldık, ' + F.para(c.odenen) + ' ödedik.' + odemeKirilimi;
      } else {
        s.cari = 'Bircan Abi\'ye ' + F.para(Math.abs(c.kalan)) +
          ' fazla ödeme yapılmış görünüyor; bu tutar ondan alacağımızdır.';
      }

      s.gelir = b.gelirler.length
        ? b.gelirler.length + ' tahsilatla toplam ' + F.para(b.gelir) +
          ' girdi. En büyüğü ' + F.para(Math.max.apply(null, b.gelirler.map(function (r) { return +r.tutar; }))) + '.'
        : 'Henüz gelir kaydı girilmemiş.';

      s.gider = b.giderler.length
        ? 'Bankadan toplam ' + F.para(b.gider) + ' çıktı: ' + F.para(b.giderBircanOdeme) +
          '’si Bircan Abi\'ye mal borcu ödemesi, ' + F.para(b.giderBircanIs) +
          '’si Bircan işi için başkalarına ödenen masraf, ' + F.para(b.giderDiger) +
          '’si diğer işletme gideri.'
        : 'Henüz gider kaydı girilmemiş.';

      var urun = this.grupNorm(c.sip, function (r) { return r.urun; }, function (r) { return r.toplam; })
        .sort(function (a, b2) { return b2.v - a.v; });
      s.malAlimi = urun.length
        ? c.sip.length + ' alım satırında Bircan Abi\'den toplam ' + F.para(c.malAlimi) +
          ' mal alındı. En çok para “' + urun[0].k + '” kalemine gitti (' +
          F.para(urun[0].v) + ').'
        : 'Henüz mal alımı kaydı girilmemiş.';

      return s;
    }
  };

  /* ---------- disari acilan yuzey ---------- */
  var api = {
    Hesap: Hesap, F: F, AYLAR: AYLAR,
    normAnahtar: normAnahtar, trendyolMu: trendyolMu, uzaklik: uzaklik
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  kok.SR = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
