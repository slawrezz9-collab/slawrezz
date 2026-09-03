/* ============================================================
   API + SENKRON
   ------------------------------------------------------------
   Sunucu = Google Apps Script web uygulamasi. Veri = Google E-Tablolar.

   VERI KAYBI ONLEME (Bedlek Tarim'da acisi cekilmis kalip):
   - Sunucuya HER ZAMAN tek kayitlik islem gonderilir ("su kaydi ekle"),
     asla "tum liste bu" denmez. Boylece eski bir anlik goruntu, baska
     cihazin yeni kaydini EZEMEZ.
   - Gonderilemeyen islem kaybolmaz: outbox'a yazilir, baglanti gelince
     otomatik gonderilir. Kullaniciya ustte uyari bandi gosterilir.
   - Her basarili yazmadan sonra sunucu guncel tam veriyi geri doner;
     yerel kopya onunla tazelenir.
   ============================================================ */
(function (kok) {
  'use strict';

  /* ============================================================
     KURULUMDA DOLDURULACAK IKI ALAN
     Ikisini de KURULUM.md anlatiyor.
     ============================================================ */
  var ADRES = 'https://script.google.com/macros/s/AKfycbwOPa0XQaaP5dU4zGHlo8DEgSE7kM7Bt_tTLsV2Z5d8KPKhIVQbafm4_rbc_FbtoeQNvg/exec';
  var ANAHTAR = '643b9154eebe4ee39334325d86d00036';

  /* Apps Script yavas olabilir; ama sonsuza kadar beklemek de olmaz. */
  var ZAMAN_ASIMI = 30000;

  /* ---------- dayanikli saklama (gizli sekme / dolu disk halinde bellege duser) ---------- */
  var Kutu = (function () {
    var calisiyor = true, bellek = {};
    try {
      localStorage.setItem('__sr', '1');
      localStorage.removeItem('__sr');
    } catch (h) { calisiyor = false; }
    return {
      al: function (k) {
        try { return calisiyor ? localStorage.getItem(k) : (bellek[k] || null); }
        catch (h) { return bellek[k] || null; }
      },
      yaz: function (k, v) {
        try { calisiyor ? localStorage.setItem(k, v) : (bellek[k] = v); }
        catch (h) { bellek[k] = v; }
      },
      sil: function (k) {
        try { calisiyor ? localStorage.removeItem(k) : delete bellek[k]; }
        catch (h) { delete bellek[k]; }
      }
    };
  })();

  var ANAHTARLAR = {
    veri: 'sr.veri.v1',
    outbox: 'sr.outbox.v1',
    kullanici: 'sr.kullanici',
    tema: 'sr.tema'
  };

  function jsonAl(anahtar, varsayilan) {
    try { return JSON.parse(Kutu.al(anahtar)) || varsayilan; }
    catch (h) { return varsayilan; }
  }
  function jsonYaz(anahtar, deger) { Kutu.yaz(anahtar, JSON.stringify(deger)); }

  /* ============================================================
     Api
     ============================================================ */
  var Api = {
    pin: null,
    kullanici: Kutu.al(ANAHTARLAR.kullanici) || '',
    kurulu: function () {
      /* Sayfa Apps Script'ten sunuluyorsa adres/anahtar gerekmez. */
      if (Api.icerden()) return true;
      return ADRES.indexOf('script.google.com') >= 0 && ANAHTAR.indexOf('BURAYA') < 0;
    },
    adres: function () { return ADRES; },

    /** Sayfa dogrudan Apps Script tarafindan mi sunuluyor? */
    icerden: function () {
      return typeof google !== 'undefined' && google.script && google.script.run;
    },

    /**
     * Tek istek yolu.
     *
     * IKI TASIYICI VAR:
     *  1) Sayfa Apps Script'ten sunuluyorsa google.script.run kullanilir.
     *     Adres, gizli anahtar, CORS derdi yoktur; Google zaten kimligi bilir.
     *  2) Sayfa baska bir adreste (GitHub Pages) duruyorsa fetch kullanilir.
     *     Content-Type text/plain'dir: application/json, Apps Script'in
     *     cevaplayamadigi bir CORS preflight istegi tetikler.
     */
    cagir: function (op, ek) {
      var govde = Object.assign({
        op: op,
        anahtar: ANAHTAR,
        pin: Api.pin,
        kullanici: Api.kullanici
      }, ek || {});

      if (Api.icerden()) return Api.icerdenCagir(govde);

      if (!Api.kurulu()) {
        return Promise.reject(new Error(
          'Sunucu adresi henüz girilmemiş. web/api.js dosyasındaki ADRES ve ANAHTAR ' +
          'alanlarını KURULUM.md’deki gibi doldurun.'
        ));
      }

      /* Zaman asimi: istek hic sonuclanmazsa arayuz sonsuza kadar
         "kaydediliyor" durumunda kalmasin. */
      var kesici = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var zamanAsimi = setTimeout(function () {
        if (kesici) kesici.abort();
      }, ZAMAN_ASIMI);

      return fetch(ADRES, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(govde),
        redirect: 'follow',
        signal: kesici ? kesici.signal : undefined
      }).then(function (y) {
        clearTimeout(zamanAsimi);
        return y;
      }, function (h) {
        clearTimeout(zamanAsimi);
        throw h;
      }).then(function (y) {
        if (!y.ok) throw new Error('Sunucuya ulaşıldı ama hata döndü (' + y.status + ').');
        return y.text();
      }).then(function (metin) {
        var c;
        try { c = JSON.parse(metin); }
        catch (h) {
          throw new Error('Sunucudan beklenmeyen bir cevap geldi. ' +
            'Dağıtım ayarı "Bağlantıya sahip herkes" mi, kontrol edin.');
        }
        if (!c.ok && c.yetkisiz) { var e = new Error(c.hata); e.yetkisiz = true; throw e; }
        if (!c.ok && c.pinGerekli) { var e2 = new Error(c.hata); e2.pinGerekli = true; throw e2; }
        return c;
      }).catch(function (h) {
        /* Kesilen istek ve ag hatasi, kullanici acisindan ayni sey:
           kayit gonderilemedi → kuyruga alinmali, ASLA kaybolmamali. */
        if (h && (h.name === 'AbortError' || h.name === 'TimeoutError')) {
          var z = new Error('Sunucu ' + Math.round(ZAMAN_ASIMI / 1000) +
            ' saniyede cevap vermedi. Kayıt telefonda saklandı.');
          z.cevrimdisi = true;
          throw z;
        }
        if (h instanceof TypeError) {
          var e = new Error('İnternet bağlantısı yok ya da sunucuya ulaşılamıyor.');
          e.cevrimdisi = true;
          throw e;
        }
        throw h;
      });
    },

    /** google.script.run — Apps Script sayfayi kendisi sunuyorsa kullanilir. */
    icerdenCagir: function (govde) {
      return new Promise(function (coz, red) {
        var bitti = false;
        var zamanAsimi = setTimeout(function () {
          if (bitti) return;
          bitti = true;
          var z = new Error('Sunucu ' + Math.round(ZAMAN_ASIMI / 1000) +
            ' saniyede cevap vermedi. Kayıt telefonda saklandı.');
          z.cevrimdisi = true;
          red(z);
        }, ZAMAN_ASIMI);

        google.script.run
          .withSuccessHandler(function (metin) {
            if (bitti) return;
            bitti = true; clearTimeout(zamanAsimi);
            try { coz(JSON.parse(metin)); }
            catch (h) { red(new Error('Sunucudan beklenmeyen bir cevap geldi.')); }
          })
          .withFailureHandler(function (h) {
            if (bitti) return;
            bitti = true; clearTimeout(zamanAsimi);
            /* Baglanti kopmasi da buraya duser; kayit kaybolmasin diye
               cevrimdisi sayilir ve kuyruga alinir. */
            var e = new Error((h && h.message) ? h.message : 'Sunucuya ulaşılamadı.');
            e.cevrimdisi = true;
            red(e);
          })
          .istek(JSON.stringify(govde));
      });
    },

    /* ---------- onbellek ---------- */
    yerelVeri: function () { return jsonAl(ANAHTARLAR.veri, null); },
    yerelVeriYaz: function (v) { jsonYaz(ANAHTARLAR.veri, v); },
    kullaniciYaz: function (ad) {
      Api.kullanici = ad || '';
      Kutu.yaz(ANAHTARLAR.kullanici, Api.kullanici);
    },
    tema: function (t) {
      if (t === undefined) return Kutu.al(ANAHTARLAR.tema) || '';
      Kutu.yaz(ANAHTARLAR.tema, t);
    },

    /* ---------- outbox ---------- */
    kuyruk: function () { return jsonAl(ANAHTARLAR.outbox, []); },
    kuyrugaEkle: function (islem) {
      var k = Api.kuyruk();
      k.push(islem);
      jsonYaz(ANAHTARLAR.outbox, k);
      return k.length;
    },
    kuyrukTemizle: function () { jsonYaz(ANAHTARLAR.outbox, []); },
    kuyrukYaz: function (k) { jsonYaz(ANAHTARLAR.outbox, k); },

    /**
     * Bekleyen islemleri sirayla gonderir.
     * Tekil olarak reddedilenler (orn. baska cihazda silinmis kayit) kuyruktan
     * dusurulur ve sebebi geri bildirilir; aksi halde kuyruk sonsuza dek tikanir.
     */
    kuyrugaBosalt: function () {
      var kuyruk = Api.kuyruk();
      if (!kuyruk.length) return Promise.resolve({ ok: true, gonderilen: 0 });

      return Api.cagir('toplu', { islemler: kuyruk }).then(function (c) {
        var reddedilen = (c.sonuclar || []).filter(function (s) { return !s.ok; });
        Api.kuyrukTemizle();
        if (c.veri) Api.yerelVeriYaz(c.veri);
        return { ok: true, gonderilen: kuyruk.length, reddedilen: reddedilen, veri: c.veri };
      });
    }
  };

  kok.SRApi = { Api: Api, Kutu: Kutu, ANAHTARLAR: ANAHTARLAR };

})(typeof globalThis !== 'undefined' ? globalThis : this);
