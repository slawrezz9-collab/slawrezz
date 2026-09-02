/* ============================================================
   DEPO + UYGULAMA
   Depo: yerel kopya + iyimser guncelleme + outbox
   App : giris ekrani, yonlendirme, gezinme, tema
   ============================================================ */
(function (kok) {
  'use strict';

  var F = kok.SR.F;
  var Hesap = kok.SR.Hesap;
  var Api = kok.SRApi.Api;
  var U = kok.UI;
  var el = U.el, kacir = U.kacir;

  /* ============================================================
     DEPO
     ============================================================ */
  var Depo = {
    veri: { acilis: 0, siparisler: [], odemeler: [], kasa: [] },
    kullanicilar: [],
    sonYedek: '',
    cevrimdisi: false,

    hesap: function () { return new Hesap(Depo.veri); },

    bul: function (tablo, id) {
      return (Depo.veri[tablo] || []).filter(function (r) { return r.id === id; })[0] || null;
    },

    yerelKaydet: function () { Api.yerelVeriYaz(Depo.veri); },

    uygula: function (cevap) {
      if (cevap.veri) {
        Depo.veri = cevap.veri;
        Depo.yerelKaydet();
      }
      if (cevap.kullanicilar) Depo.kullanicilar = cevap.kullanicilar;
      if (cevap.sonYedek !== undefined) Depo.sonYedek = cevap.sonYedek;
      Depo.cevrimdisi = false;
    },

    /** Acilista ve elle yenilemede sunucudan tam veri ceker. */
    tazele: function (sessizDegil) {
      return Api.cagir('oku').then(function (c) {
        if (!c.ok) throw new Error(c.hata || 'Veri okunamadı.');
        Depo.uygula(c);
        return c;
      }).catch(function (h) {
        if (h.cevrimdisi) {
          Depo.cevrimdisi = true;
          var yerel = Api.yerelVeri();
          if (yerel) {
            Depo.veri = yerel;
            if (sessizDegil) U.bildir('İnternet yok — en son kaydedilen veriler gösteriliyor.');
            return { ok: true, cevrimdisi: true };
          }
        }
        throw h;
      });
    },

    /* ---------- yazma islemleri ----------
       Sunucuya HER ZAMAN tek kayitlik islem gonderilir; asla "tum liste bu"
       denmez. Boylece eski bir anlik goruntu baska cihazin kaydini ezemez. */

    ekle: function (tablo, kayit) {
      var gecici = Object.assign({ id: 'yerel-' + Math.random().toString(36).slice(2, 9), _bekliyor: true }, kayit);
      Depo.veri[tablo] = (Depo.veri[tablo] || []).concat([gecici]);
      Depo.yerelKaydet();

      return Api.cagir('ekle', { tablo: tablo, kayit: kayit })
        .then(function (c) {
          if (!c.ok) throw new Error(c.hata);
          Depo.uygula(c);
          U.bildir('Kayıt eklendi.');
        })
        .catch(function (h) { return Depo.kuyruklaVeyaGeriAl(h, { tip: 'ekle', tablo: tablo, kayit: kayit, yerelId: gecici.id }, function () {
          Depo.veri[tablo] = Depo.veri[tablo].filter(function (r) { return r.id !== gecici.id; });
        }); });
    },

    guncelle: function (tablo, kayit) {
      var eski = Depo.bul(tablo, kayit.id);
      var eskiKopya = eski ? Object.assign({}, eski) : null;
      if (eski) {
        Object.assign(eski, kayit, { _bekliyor: true });
        Depo.yerelKaydet();
      }

      return Api.cagir('guncelle', { tablo: tablo, kayit: kayit })
        .then(function (c) {
          if (!c.ok) throw new Error(c.hata);
          Depo.uygula(c);
          U.bildir('Kayıt güncellendi.');
        })
        .catch(function (h) { return Depo.kuyruklaVeyaGeriAl(h, { tip: 'guncelle', tablo: tablo, kayit: kayit, yerelId: kayit.id }, function () {
          if (eskiKopya) {
            var suan = Depo.bul(tablo, kayit.id);
            if (suan) Object.assign(suan, eskiKopya);
          }
        }); });
    },

    sil: function (tablo, id) {
      var eski = Depo.bul(tablo, id);
      var sira = (Depo.veri[tablo] || []).indexOf(eski);
      Depo.veri[tablo] = (Depo.veri[tablo] || []).filter(function (r) { return r.id !== id; });
      Depo.yerelKaydet();

      return Api.cagir('sil', { tablo: tablo, id: id })
        .then(function (c) {
          if (!c.ok) throw new Error(c.hata);
          Depo.uygula(c);
          U.bildir('Kayıt silindi.');
        })
        .catch(function (h) { return Depo.kuyruklaVeyaGeriAl(h, { tip: 'sil', tablo: tablo, id: id, yerelId: id }, function () {
          if (eski) Depo.veri[tablo].splice(Math.max(0, sira), 0, eski);
        }); });
    },

    /**
     * Baglanti yoksa islemi kuyruga alir (veri KAYBOLMAZ).
     * Sunucu isi reddettiyse (gecersiz veri, silinmis kayit) yerel degisiklik
     * geri alinir ve hata kullaniciya soylenir — sessizce yutulmaz.
     */
    kuyruklaVeyaGeriAl: function (hata, islem, geriAl) {
      if (hata.cevrimdisi) {
        Api.kuyrugaEkle(islem);
        Depo.cevrimdisi = true;
        Depo.yerelKaydet();
        U.bildir('İnternet yok — kayıt telefonda saklandı, bağlantı gelince gönderilecek.');
        App.bantTazele();
        return;
      }
      geriAl();
      Depo.yerelKaydet();
      throw hata;
    },

    /** Baglanti gelince bekleyen islemleri gonderir. */
    kuyrugaBosalt: function () {
      if (!Api.kuyruk().length) return Promise.resolve();
      return Api.kuyrugaBosalt().then(function (s) {
        Depo.cevrimdisi = false;
        if (s.veri) { Depo.veri = s.veri; Depo.yerelKaydet(); }

        if (s.reddedilen && s.reddedilen.length) {
          U.bildir(s.reddedilen.length + ' kayıt sunucuya yazılamadı: ' +
            s.reddedilen[0].hata, true);
        } else {
          U.bildir(s.gonderilen + ' bekleyen kayıt gönderildi.');
        }
        App.bantTazele();
        App.ciz();
      }).catch(function (h) {
        if (!h.cevrimdisi) U.bildir(h.message, true);
      });
    },

    ayarYaz: function (anahtarAdi, deger) {
      return Api.cagir('ayarYaz', { anahtarAdi: anahtarAdi, deger: deger })
        .then(function (c) {
          if (!c.ok) throw new Error(c.hata);
          Depo.uygula(c);
        });
    },

    durum: function () {
      var bekleyen = Api.kuyruk().length;
      return {
        bekleyen: bekleyen,
        sonYedek: Depo.sonYedek,
        metin: Depo.cevrimdisi
          ? 'Çevrimdışı — veriler telefonda'
          : bekleyen ? bekleyen + ' kayıt gönderilmeyi bekliyor'
          : 'Bağlı — Google E-Tablolar'
      };
    }
  };

  /* ============================================================
     SAYFALAR
     ============================================================ */
  var SAYFALAR = [
    { id: 'ozet', ad: 'Özet', baslik: 'Özet', alt: 'Genel durum', simge: 'ozet', sekme: true },
    { id: 'gelirler', ad: 'Gelir', baslik: 'Gelirler', alt: 'Slaw Rezz banka hesabı', simge: 'gelir', sekme: true },
    { id: 'giderler', ad: 'Gider', baslik: 'Giderler', alt: 'Slaw Rezz banka hesabı', simge: 'gider', sekme: true },
    { id: 'cari', ad: 'Cari', baslik: 'Cari Hesap', alt: 'Bircan Abi — tedarikçi', simge: 'cari', sekme: true },
    { id: 'urunler', ad: 'Mal Alımı', baslik: 'Mal Alım Analizi', alt: 'Ürün ve ay kırılımı', simge: 'urun' },
    { id: 'rapor', ad: 'Aylık Rapor', baslik: 'Aylık Rapor', alt: 'Yazdır veya PDF kaydet', simge: 'rapor' },
    { id: 'ayarlar', ad: 'Ayarlar', baslik: 'Ayarlar', alt: 'Bağlantı, yedek, dışa aktarma', simge: 'ayar' }
  ];

  function sayfaBul(id) {
    return SAYFALAR.filter(function (s) { return s.id === id; })[0] || SAYFALAR[0];
  }

  /* ============================================================
     UYGULAMA
     ============================================================ */
  var App = {
    suan: 'ozet',
    raporAyi: null,

    baslat: function () {
      App.temaKur();

      if (!Api.kurulu()) {
        App.kurulumUyarisi();
        return;
      }

      // Kullanici listesi icin PIN'siz bir deneme yapamayiz; once giris ekrani.
      App.girisEkrani();
    },

    /* ---------- tema ---------- */
    temaKur: function () {
      var kayitli = Api.tema();
      if (kayitli) document.documentElement.setAttribute('data-tema', kayitli);
      else if (matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-tema', 'koyu');
      }
      App.temaRengiTazele();
    },
    temaDegistir: function () {
      var koyuMu = document.documentElement.getAttribute('data-tema') === 'koyu';
      var yeni = koyuMu ? 'acik' : 'koyu';
      document.documentElement.setAttribute('data-tema', yeni);
      Api.tema(yeni);
      App.temaRengiTazele();
      App.ciz();
    },
    temaRengiTazele: function () {
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', U.cssDeger('--kagit') || '#F5F2EA');
    },

    /* ---------- kurulum uyarisi ---------- */
    kurulumUyarisi: function () {
      document.getElementById('kok').innerHTML =
        '<div class="giris"><div class="giris-kart">' +
          '<div class="marka">Slaw Rezz</div>' +
          '<div class="alt-marka">Muhasebe</div>' +
          '<div class="uyari-kutu"><b>Kurulum tamamlanmamış.</b><br>' +
          '<code>web/api.js</code> dosyasındaki <b>ADRES</b> ve <b>ANAHTAR</b> ' +
          'alanları henüz doldurulmamış. KURULUM.md dosyasındaki 5. adımı uygulayın.</div>' +
        '</div></div>';
    },

    /* ---------- giris: 1) PIN  2) kim giriyor ----------
       Kullanici listesi Ayarlar sekmesinde durdugu icin PIN'den ONCE
       okunamaz — bu yuzden iki adimli. */
    girisEkrani: function () {
      var ekran = el(
        '<div class="giris"><div class="giris-kart">' +
          '<div class="marka">Slaw Rezz</div>' +
          '<div class="alt-marka">Muhasebe defteri</div>' +
          '<div class="alan"><label for="pin-1">PIN</label>' +
            '<div class="pin-sira">' +
              [1, 2, 3, 4, 5, 6].map(function (i) {
                return '<input id="pin-' + i + '" type="password" inputmode="numeric" ' +
                  'autocomplete="off" maxlength="1" aria-label="PIN hane ' + i + '">';
              }).join('') +
            '</div>' +
            '<div class="ipucu">4–6 haneli PIN. Doğru PIN girilmeden hiçbir rakam görünmez.</div>' +
          '</div>' +
          '<p class="giris-hata" data-hata role="alert"></p>' +
          '<button class="dg ana" style="width:100%" data-gir>Aç</button>' +
        '</div></div>'
      );

      document.getElementById('kok').innerHTML = '';
      document.getElementById('kok').appendChild(ekran);

      var kutular = [].slice.call(ekran.querySelectorAll('.pin-sira input'));
      kutular.forEach(function (k, i) {
        k.addEventListener('input', function () {
          k.value = k.value.replace(/\D/g, '').slice(0, 1);
          if (k.value && kutular[i + 1]) kutular[i + 1].focus();
          /* 4 hane doldu ve sonrası boşsa kullanıcı Enter'a basmadan bekleyebilir */
        });
        k.addEventListener('keydown', function (e) {
          if (e.key === 'Backspace' && !k.value && kutular[i - 1]) kutular[i - 1].focus();
          if (e.key === 'Enter') gir();
        });
        k.addEventListener('paste', function (e) {
          var yapistirilan = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
          if (!yapistirilan) return;
          e.preventDefault();
          kutular.forEach(function (kk, ix) { kk.value = yapistirilan.charAt(ix) || ''; });
          kutular[Math.min(yapistirilan.length, kutular.length - 1)].focus();
        });
      });
      setTimeout(function () { kutular[0].focus(); }, 120);

      var hataAlan = ekran.querySelector('[data-hata]');
      var girBtn = ekran.querySelector('[data-gir]');
      girBtn.onclick = gir;

      function gir() {
        var pin = kutular.map(function (k) { return k.value; }).join('');
        if (pin.length < 4) { hataAlan.textContent = 'PIN en az 4 hane olmalı.'; return; }

        hataAlan.textContent = '';
        girBtn.disabled = true;
        girBtn.innerHTML = '<span class="donuyor"></span> Açılıyor';

        Api.pin = pin;

        Depo.tazele().then(function () {
          App.kullaniciSec();
        }).catch(function (h) {
          Api.pin = null;
          girBtn.disabled = false;
          girBtn.textContent = 'Aç';
          kutular.forEach(function (k) { k.value = ''; });
          kutular[0].focus();
          hataAlan.textContent = h.message ||
            'Açılamadı. İnternet bağlantınızı ve PIN’i kontrol edin.';
        });
      }
    },

    /** PIN dogrulandiktan sonra: kim giriyor? */
    kullaniciSec: function () {
      var liste = Depo.kullanicilar || [];
      var kayitli = Api.kullanici;

      /* Tek kullanici tanimliysa ya da daha once secilmisse sorma */
      if (kayitli && (!liste.length || liste.indexOf(kayitli) >= 0)) return App.arayuzKur();
      if (liste.length === 1) { Api.kullaniciYaz(liste[0]); return App.arayuzKur(); }

      var ekran = el(
        '<div class="giris"><div class="giris-kart">' +
          '<div class="marka">Kim giriyor?</div>' +
          '<div class="alt-marka">Eklediğiniz kayıtların yanında bu ad görünür.</div>' +
          '<div class="menu-liste">' +
            liste.map(function (ad) {
              return '<button data-kisi="' + kacir(ad) + '">' + kacir(ad) + '</button>';
            }).join('') +
          '</div>' +
          '<div class="alan" style="margin-top:16px"><label for="baska-ad">Listede yoksa</label>' +
            '<input id="baska-ad" type="text" autocomplete="name" placeholder="Adınız" value="' +
            kacir(kayitli) + '"></div>' +
          '<p class="giris-hata" data-hata role="alert"></p>' +
          '<button class="dg ana" style="width:100%" data-devam>Devam</button>' +
        '</div></div>'
      );

      document.getElementById('kok').innerHTML = '';
      document.getElementById('kok').appendChild(ekran);

      ekran.querySelectorAll('[data-kisi]').forEach(function (b) {
        b.onclick = function () {
          Api.kullaniciYaz(b.getAttribute('data-kisi'));
          App.arayuzKur();
        };
      });
      ekran.querySelector('[data-devam]').onclick = function () {
        var ad = ekran.querySelector('#baska-ad').value.trim();
        if (!ad) { ekran.querySelector('[data-hata]').textContent = 'Bir ad seçin veya yazın.'; return; }
        Api.kullaniciYaz(ad);
        App.arayuzKur();
      };
    },

    cikis: function () {
      Api.pin = null;
      U.bildir('Çıkış yapıldı.');
      App.girisEkrani();
    },

    /* ---------- ana iskelet ---------- */
    arayuzKur: function () {
      var sekmeler = SAYFALAR.filter(function (s) { return s.sekme; });

      document.getElementById('kok').innerHTML =
        '<div class="kabuk">' +
          '<nav class="ray" aria-label="Ana menü"></nav>' +
          '<div style="min-width:0">' +
            '<div data-bant></div>' +
            '<header class="tepe">' +
              '<div class="baslik"><h1 id="sayfa-baslik">Özet</h1>' +
              '<div class="alt" id="sayfa-alt"></div></div>' +
              '<button class="dg simge" id="tema-dg" title="Açık / koyu tema" aria-label="Temayı değiştir">' +
                U.S.tema + '</button>' +
            '</header>' +
            '<main class="govde" id="govde"></main>' +
          '</div>' +
        '</div>' +
        '<nav class="altbar" aria-label="Alt menü">' +
          sekmeler.map(function (s) {
            return '<button data-git="' + s.id + '">' + U.S[s.simge] + '<span>' + kacir(s.ad) + '</span></button>';
          }).join('') +
          '<button data-daha>' + U.S.daha + '<span>Daha</span></button>' +
        '</nav>' +
        '<button class="fab" data-yeni aria-label="Yeni kayıt ekle">+</button>';

      /* sol ray (masaüstü) */
      var ray = document.querySelector('.ray');
      ray.innerHTML =
        '<div class="marka">Slaw Rezz</div>' +
        '<div class="marka-alt">Muhasebe defteri</div>' +
        '<div class="grup">Banka hesabı</div>' +
        ['ozet', 'gelirler', 'giderler'].map(rayDugmesi).join('') +
        '<div class="grup">Bircan Abi — tedarikçi</div>' +
        ['cari', 'urunler'].map(rayDugmesi).join('') +
        '<div class="grup">Sistem</div>' +
        ['rapor', 'ayarlar'].map(rayDugmesi).join('') +
        '<div style="flex:1"></div>' +
        '<button data-yeni-ray>' + U.S.arti + 'Yeni kayıt</button>';

      function rayDugmesi(id) {
        var s = sayfaBul(id);
        return '<button data-git="' + s.id + '">' + U.S[s.simge] + kacir(s.baslik) + '</button>';
      }

      document.querySelectorAll('[data-git]').forEach(function (b) {
        b.onclick = function () { App.git(b.getAttribute('data-git')); };
      });
      document.querySelector('[data-daha]').onclick = App.dahaMenusu;
      document.querySelector('[data-yeni]').onclick = App.yeniKayit;
      document.querySelector('[data-yeni-ray]').onclick = App.yeniKayit;
      document.getElementById('tema-dg').onclick = App.temaDegistir;

      /* baglanti olaylari */
      window.addEventListener('online', function () {
        U.bildir('Bağlantı geldi, bekleyen kayıtlar gönderiliyor…');
        Depo.kuyrugaBosalt();
      });
      window.addEventListener('offline', function () {
        Depo.cevrimdisi = true;
        App.bantTazele();
      });

      /* geri tusu sayfalar arasinda calissin */
      window.addEventListener('hashchange', function () {
        var id = location.hash.replace('#', '') || 'ozet';
        if (id !== App.suan) { App.suan = id; App.ciz(); }
      });

      App.suan = location.hash.replace('#', '') || 'ozet';
      App.ciz();
      App.bantTazele();

      // acilista bekleyen is varsa gonder
      if (navigator.onLine) Depo.kuyrugaBosalt();
    },

    git: function (id) {
      App.suan = id;
      location.hash = '#' + id;
      App.ciz();
      window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
    },

    ciz: function () {
      var sayfa = sayfaBul(App.suan);
      App.suan = sayfa.id;

      document.getElementById('sayfa-baslik').textContent = sayfa.baslik;
      document.getElementById('sayfa-alt').textContent = sayfa.alt;
      document.title = sayfa.baslik + ' · Slaw Rezz Muhasebe';

      document.querySelectorAll('[data-git]').forEach(function (b) {
        var etkin = b.getAttribute('data-git') === sayfa.id;
        if (etkin) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });

      var govde = document.getElementById('govde');
      govde.innerHTML = '';
      U.ipucuGizle();
      govde.appendChild(kok.Gorunum[sayfa.id]());
    },

    /* ---------- bekleyen kayit bandi ---------- */
    bantTazele: function () {
      var yer = document.querySelector('[data-bant]');
      if (!yer) return;
      var bekleyen = Api.kuyruk().length;

      if (!bekleyen) { yer.innerHTML = ''; return; }
      yer.innerHTML =
        '<div class="bant">' +
          '<span><b>' + bekleyen + ' kayıt henüz gönderilmedi.</b> ' +
          'Telefonda güvende duruyor; bağlantı gelince kendiliğinden gidecek.</span>' +
          '<button class="dg" data-simdi>Şimdi dene</button>' +
        '</div>';
      yer.querySelector('[data-simdi]').onclick = function () { Depo.kuyrugaBosalt(); };
    },

    /* ---------- "Daha" alt menusu ---------- */
    dahaMenusu: function () {
      var durum = Depo.durum();
      var kip = el(
        '<div class="kip" role="dialog" aria-modal="true">' +
          '<h3>Daha fazlası</h3>' +
          '<div class="icerik"><div class="menu-liste">' +
            '<button data-menu="urunler">' + U.S.urun + 'Mal Alım Analizi</button>' +
            '<button data-menu="rapor">' + U.S.rapor + 'Aylık Rapor</button>' +
            '<button data-menu="ayarlar">' + U.S.ayar + 'Ayarlar' +
              '<span class="kucuk-not">' + kacir(durum.metin) + '</span></button>' +
            '<button data-tema>' + U.S.tema + 'Açık / koyu tema</button>' +
            '<button data-cikis>' + U.S.cikis + 'Çıkış yap</button>' +
          '</div></div>' +
          '<div class="ayak"><button class="dg" data-kapat>Kapat</button></div>' +
        '</div>'
      );
      var kapat = U.kipAc(kip);
      kip.querySelector('[data-kapat]').onclick = kapat;
      kip.querySelectorAll('[data-menu]').forEach(function (b) {
        b.onclick = function () { kapat(); App.git(b.getAttribute('data-menu')); };
      });
      kip.querySelector('[data-tema]').onclick = function () { kapat(); App.temaDegistir(); };
      kip.querySelector('[data-cikis]').onclick = function () { kapat(); App.cikis(); };
    },

    /* ---------- yeni kayit ---------- */
    yeniKayit: function () {
      /* sayfaya gore dogrudan ilgili formu ac */
      if (App.suan === 'gelirler') return App.formAc('kasa', 'Gelir');
      if (App.suan === 'giderler') return App.formAc('kasa', 'Gider');

      var kip = el(
        '<div class="kip" role="dialog" aria-modal="true">' +
          '<h3>Ne eklemek istiyorsunuz?</h3>' +
          '<div class="icerik"><div class="menu-liste">' +
            '<button data-t="gelir">' + U.S.gelir + 'Bankaya para girdi' +
              '<span class="kucuk-not">gelir</span></button>' +
            '<button data-t="gider">' + U.S.gider + 'Bankadan para çıktı' +
              '<span class="kucuk-not">gider</span></button>' +
            '<button data-t="siparis">' + U.S.cari + 'Bircan Abi\'den mal aldık' +
              '<span class="kucuk-not">maliyet</span></button>' +
            '<button data-t="odeme">' + U.S.cari + 'Bircan Abi\'ye ödeme yaptık' +
              '<span class="kucuk-not">para çıkışı</span></button>' +
          '</div></div>' +
          '<div class="ayak"><button class="dg" data-kapat>Vazgeç</button></div>' +
        '</div>'
      );
      var kapat = U.kipAc(kip);
      kip.querySelector('[data-kapat]').onclick = kapat;
      kip.querySelectorAll('[data-t]').forEach(function (b) {
        b.onclick = function () {
          kapat();
          var t = b.getAttribute('data-t');
          if (t === 'gelir') App.formAc('kasa', 'Gelir');
          else if (t === 'gider') App.formAc('kasa', 'Gider');
          else if (t === 'siparis') App.formAc('siparisler');
          else App.formAc('odemeler');
        };
      });
    },

    formAc: function (tablo, suzgec) {
      var cfg = tablo === 'kasa' ? kok.CFG.kasa(suzgec)
              : tablo === 'siparisler' ? kok.CFG.siparisler() : kok.CFG.odemeler();
      U.form(cfg, null, function (kayit) {
        return Depo.ekle(tablo, kayit).then(function () { App.ciz(); });
      });
    }
  };

  kok.Depo = Depo;
  kok.App = App;

  document.addEventListener('DOMContentLoaded', function () { App.baslat(); });

})(typeof globalThis !== 'undefined' ? globalThis : this);
