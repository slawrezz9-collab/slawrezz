/**
 * ============================================================
 * KURULUM + ILK VERI AKTARIMI  (tek seferlik)
 * ------------------------------------------------------------
 * Sirasiyla su iki fonksiyon calistirilir:
 *
 *   1) kurulumYap()   → 4 sekmeyi basliklariyla olusturur, Tur kolonuna
 *                       Gelir/Gider listesi koyar, Ayarlar'i doldurur.
 *   2) veriYukle()    → Drive'daki iki ham dosyayi okur, normalize eder,
 *                       sekmelere yazar ve dogrula()'yi calistirir.
 *
 * GUVENLIK: veriYukle() sekmelerde kayit varsa CALISMAZ. Yanlislikla ikinci
 * kez calistirilip mevcut verinin uzerine yazmasi mumkun degildir.
 * ============================================================
 */

/* Drive'daki ham dosyalarin adlari (uzantisiz, E-Tablolar'a donusturulmus hali)

   DIKKAT — Drive'da "bircan abi2026" adinda ESKI bir E-Tablo var (28 Agustos).
   Guncel banka verisi "SLAWREZZ_Banka_Hesabi_Guncel" dosyasindadir. Yanlis
   dosyayi okumamak icin ad burada acikca yazilir.

   Hangi dosyanin secilecegini gormek icin once dosyalariKontrolEt() calistirin. */
var HAM_CARI = 'SLAWREZZ_Musteri_Takip- BİRCAN';   /* Bircan cari: ondan aldigimiz mallar */
var HAM_BANKA = 'SLAWREZZ_Banka_Hesabi_Guncel';    /* Slaw Rezz banka hesabi hareketleri  */

/* Kaynak dosyalarin durdugu Drive klasorunun KIMLIGI.
   Arama YALNIZCA bu klasorde yapilir; boylece Drive'in baska yerindeki ayni
   adli eski dosyalar (orn. 28 Agustos tarihli "bircan abi2026") kesinlikle
   okunamaz.

   Kimligi klasorun adres cubugundan alirsiniz:
     https://drive.google.com/drive/folders/XXXXXXXXXXXXXXXX
                                            ^^^^^^^^^^^^^^^^ bu kisim

   Bos birakilirsa tum Drive taranir (daha riskli, onerilmez).               */
var KAYNAK_KLASOR_ID = '1JRWDWhUDO1qza_on-6bYcXwYfiPVkErd';

/* ============================================================
   1) SEKMELERI KUR
   ============================================================ */

function kurulumYap() {
  var kit = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(SEKMELER).forEach(function (anahtar) {
    var cfg = SEKMELER[anahtar];
    var s = kit.getSheetByName(cfg.ad) || kit.insertSheet(cfg.ad);
    s.getRange(1, 1, 1, cfg.basliklar.length)
      .setValues([cfg.basliklar])
      .setFontWeight('bold')
      .setBackground('#EFECE4');
    s.setFrozenRows(1);
    for (var i = 1; i <= cfg.basliklar.length; i++) s.autoResizeColumn(i);
  });

  // Tur kolonuna veri dogrulama listesi
  var kasa = kit.getSheetByName(SEKMELER.kasa.ad);
  var turKolonu = SEKMELER.kasa.basliklar.indexOf('Tur') + 1;
  var kural = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Gelir', 'Gider'], true)
    .setAllowInvalid(false)
    .setHelpText('Yalnızca "Gelir" veya "Gider" yazılabilir.')
    .build();
  kasa.getRange(2, turKolonu, 2000, 1).setDataValidation(kural);

  // Ayarlar sekmesi
  var ay = kit.getSheetByName(AYAR_SEKMESI) || kit.insertSheet(AYAR_SEKMESI);
  if (ay.getLastRow() < 1) {
    ay.getRange(1, 1, 1, 2).setValues([['anahtar', 'deger']])
      .setFontWeight('bold').setBackground('#EFECE4');
    ay.setFrozenRows(1);
  }
  var varsayilan = [
    /* 0 olmali: devreden bakiye cari dosyasinda "eski bakiye" adli normal bir
       alim satiri olarak duruyor. Buraya da yazilirsa IKI KEZ sayilir. */
    ['acilis_bakiye', 0],
    ['kullanicilar', 'Mustafa'],
    ['gizli_anahtar', ''],
    ['pin_hash', ''],
    ['pin_salt', ''],
    ['yedek_klasor_id', ''],
    ['son_yedek', '']
  ];
  var mevcut = ayarlariOku();
  varsayilan.forEach(function (satir) {
    if (!(satir[0] in mevcut)) ay.appendRow(satir);
  });

  // Gizli anahtar yoksa hemen uret
  if (!ayarlariOku().gizli_anahtar) gizliAnahtarUret();

  Logger.log('Kurulum tamam. Sekmeler: Siparisler, Odemeler, Kasa, Ayarlar');
  Logger.log('Sirada: pinBelirle() → veriYukle()');
}

/* ============================================================
   2) HAM XLSX -> SEKMELER
   ============================================================ */

function veriYukle() {
  var kit = SpreadsheetApp.getActiveSpreadsheet();

  // --- guvenlik kilidi: uzerine yazma yok ---
  var dolu = Object.keys(SEKMELER).filter(function (a) {
    var s = kit.getSheetByName(SEKMELER[a].ad);
    return s && s.getLastRow() > 1;
  });
  if (dolu.length) {
    throw new Error(
      'Bu sekmelerde zaten kayıt var: ' + dolu.join(', ') + '. ' +
      'İlk yükleme yalnızca boş sekmelere yapılır. Gerçekten sıfırdan yüklemek ' +
      'istiyorsanız önce yedek alın, sonra o sekmelerin 2. satırdan aşağısını elle silin.'
    );
  }

  var cari = hamOku(HAM_CARI);
  var banka = hamOku(HAM_BANKA);

  var alimlar = cariAlimlari(cari);
  var odemeler = cariOdemeleri(cari);
  var kasa = bankaKasa(banka);

  /* Trendyol aciklamalarindaki yazim hatalarini duzelt (TRENYOL, TREDYOL,
     Terendyol → TRENDYOL). Parayi ALAN korunur: SLAW REZZ ile Dummy ayri kalir. */
  trendyolYazimlariniDuzelt(kasa).forEach(function (d) {
    Logger.log('duzeltildi: "%s"  ->  "%s"', d[0], d[1]);
  });

  if (!alimlar.length || !kasa.length) {
    throw new Error('Ham dosyalardan kayıt çıkarılamadı. Dosya adlarını ve sekme yapısını kontrol edin.');
  }

  yaz('siparisler', alimlar);
  yaz('odemeler', odemeler);
  yaz('kasa', kasa);

  /* Devreden bakiye cari dosyasinda "eski bakiye" adli normal bir alim
     satiri olarak duruyor; ayrica acilis mahsubu yazilirsa IKI KEZ sayilir. */
  ayarYaz('acilis_bakiye', 0);

  Logger.log('Yazildi: %s alim / %s cari odeme / %s kasa hareketi',
    alimlar.length, odemeler.length, kasa.length);
  Logger.log('---');
  dogrula();
}

function yaz(tabloAdi, kayitlar) {
  var cfg = SEKMELER[tabloAdi];
  var s = sekme(cfg.ad);
  var satirlar = kayitlar.map(function (k) {
    k.id = cfg.onEk + '-' + Utilities.getUuid().slice(0, 8);
    k.ekleyen = 'ilk yükleme';
    k.eklemeZamani = simdi();
    return satiraCevir(cfg, k);
  });
  s.getRange(2, 1, satirlar.length, cfg.basliklar.length).setValues(satirlar);
}

/**
 * Ham dosyayi Drive'da adiyla bulur ve ilk sekmesinin tamamini dondurur.
 *
 * Ayni adda birden fazla dosya olabilir (bir .xlsx, bir de ondan uretilen
 * E-Tablo gibi). Bu yuzden:
 *   - yalnizca Google E-Tablo bicimindekiler dikkate alinir
 *   - birden fazla varsa EN YENI degistirilmis olan secilir
 *   - hangisinin secildigi Logger'a yazilir ki yanlis dosya sessizce okunmasin
 */
function hamOku(dosyaAdi) {
  var adaylar = dosyaAdaylari(dosyaAdi);

  if (!adaylar.length) {
    throw new Error(
      '"' + dosyaAdi + '" adlı dosya ' + nerede() + ' bulunamadı. ' +
      'Dosyayı yüklediğinizden ve Dosya > Google E-Tablolar olarak kaydet ile ' +
      'dönüştürdüğünüzden emin olun (adında .xlsx uzantısı kalmamalı). ' +
      'Hangi dosyaların görüldüğünü görmek için dosyalariKontrolEt() çalıştırın.'
    );
  }

  var tablolar = adaylar.filter(function (d) {
    return d.getMimeType() === MimeType.GOOGLE_SHEETS;
  });

  if (!tablolar.length) {
    throw new Error(
      '"' + dosyaAdi + '" bulundu ama henüz Google E-Tablolar biçiminde değil. ' +
      'Drive\'da dosyaya çift tıklayıp Dosya > Google E-Tablolar olarak kaydet deyin, ' +
      'sonra bu adımı tekrarlayın.'
    );
  }

  tablolar.sort(function (a, b) { return b.getLastUpdated() - a.getLastUpdated(); });
  var secilen = tablolar[0];

  Logger.log('okunuyor: "%s"  (guncelleme: %s, id: %s)',
    secilen.getName(),
    Utilities.formatDate(secilen.getLastUpdated(), kitapSaatDilimi(), 'yyyy-MM-dd HH:mm'),
    secilen.getId());

  if (tablolar.length > 1) {
    Logger.log('  UYARI: bu adda %s tablo var, en yenisi secildi. ' +
      'Yanlissa eskilerin adini degistirin.', tablolar.length);
  }

  return SpreadsheetApp.openById(secilen.getId()).getSheets()[0].getDataRange().getValues();
}

/**
 * Adaylari dondurur. KAYNAK_KLASOR doluysa arama yalnizca o klasorde yapilir,
 * boylece Drive'in baska yerindeki ayni adli eski dosyalar hic gorunmez.
 */
function dosyaAdaylari(dosyaAdi) {
  var liste = [];
  var it = KAYNAK_KLASOR_ID
    ? kaynakKlasoru().getFilesByName(dosyaAdi)
    : DriveApp.getFilesByName(dosyaAdi);
  while (it.hasNext()) liste.push(it.next());
  return liste;
}

/** Kaynak klasoru kimligiyle bulur; yoksa anlasilir bir hata verir. */
function kaynakKlasoru() {
  try {
    return DriveApp.getFolderById(KAYNAK_KLASOR_ID);
  } catch (h) {
    throw new Error(
      'Kaynak klasör açılamadı (kimlik: ' + KAYNAK_KLASOR_ID + '). ' +
      'Klasör silinmiş, erişiminiz kaldırılmış ya da kimlik yanlış olabilir. ' +
      'Klasörü Drive\'da açıp adres çubuğundaki /folders/ sonrasını kopyalayıp ' +
      'veri-yukle.gs dosyasındaki KAYNAK_KLASOR_ID satırına yazın.'
    );
  }
}

function nerede() {
  if (!KAYNAK_KLASOR_ID) return 'Drive\'da';
  try {
    return '"' + kaynakKlasoru().getName() + '" klasöründe';
  } catch (h) {
    return 'kaynak klasörde';
  }
}

/**
 * Yuklemeden ONCE calistirin: hangi dosyalarin bulundugunu ve hangisinin
 * okunacagini gosterir. Hicbir sey yazmaz, sadece rapor verir.
 */
function dosyalariKontrolEt() {
  if (KAYNAK_KLASOR_ID) {
    try {
      var kl = kaynakKlasoru();
      Logger.log('Arama yeri: "%s" klasoru (yalnizca burasi)', kl.getName());
      Logger.log('klasor kimligi: %s', kl.getId());
      Logger.log('icindeki dosyalar:');
      var hepsi = kl.getFiles();
      var n = 0;
      while (hepsi.hasNext() && n < 30) {
        var d = hepsi.next();
        n++;
        Logger.log('   - %s   [%s]', d.getName(),
          d.getMimeType() === MimeType.GOOGLE_SHEETS ? 'E-Tablo' : d.getMimeType());
      }
      if (!n) Logger.log('   (klasor bos)');
    } catch (h) {
      Logger.log('HATA: %s', h.message);
      return;
    }
  } else {
    Logger.log('Arama yeri: tum Drive (klasor sinirlamasi yok)');
  }
  Logger.log('');

  [['CARI  (Bircan mal alimlari)', HAM_CARI],
   ['BANKA (hesap hareketleri)', HAM_BANKA]].forEach(function (c) {
    Logger.log('--- %s ---', c[0]);
    Logger.log('aranan ad: "%s"', c[1]);

    var adaylar;
    try {
      adaylar = dosyaAdaylari(c[1]);
    } catch (h) {
      Logger.log('  HATA: %s', h.message);
      Logger.log('');
      return;
    }

    adaylar.forEach(function (d) {
      Logger.log('  %s %s  (%s)',
        d.getMimeType() === MimeType.GOOGLE_SHEETS ? '[E-TABLO]        ' : '[DONUSTURULMEMIS]',
        Utilities.formatDate(d.getLastUpdated(), kitapSaatDilimi(), 'yyyy-MM-dd HH:mm'),
        d.getName());
    });
    if (!adaylar.length) Logger.log('  BULUNAMADI');
    Logger.log('');
  });

  Logger.log('Not: yalnizca [E-TABLO] isaretliler okunabilir, en yenisi secilir.');
}

/* ---------- SLAWREZZ_Musteri_Takip- BIRCAN: Bircan cari hesabi ----------
   Dosyanin basliklari "Satis Tarihi / Toplam Alacak" yazsa da icerik
   BIZIM ONDAN ALDIGIMIZ MALDIR: Bircan TEDARIKCIDIR, o sutun bizim ONA
   BORCUMUZDUR.
     A-E = alimlar (Satis Tarihi, Model, Adet, Birim Fiyat, Toplam)
     F-G = ona yaptigimiz odemeler (Odeme Tarihi, Odenen Tutar)
   Iki blok ayni satirda durur ama BIRBIRIYLE ILGISIZDIR. */

function cariAlimlari(satirlar) {
  var liste = [];
  for (var i = 1; i < satirlar.length; i++) {
    var r = satirlar[i];
    var urun = duzMetin(r[1]);
    var adet = hamSayi(r[2]);
    var fiyat = hamSayi(r[3]);
    var gun = hamTarih(r[0]);
    if (urun && adet && fiyat && gun) {
      liste.push({ t: gun, urun: urun, adet: adet, fiyat: fiyat });
    }
  }
  return liste;
}

function cariOdemeleri(satirlar) {
  var liste = [];
  for (var i = 1; i < satirlar.length; i++) {
    var tutar = hamSayi(satirlar[i][6]);
    var gun = hamTarih(satirlar[i][5]);
    if (tutar && gun) liste.push({ t: gun, tutar: tutar });
  }
  return liste;
}

/* ---------- SLAWREZZ_Banka_Hesabi_Guncel: A-D gelir, E-G gider ----------
   "Nereden Geldi" = bize kim para gonderdi   → GELIR
   "Nereye Gitti"  = biz kime odeme yaptik    → GIDER
   Ayni satirdaki gelir ile gider BIRBIRIYLE ILGISIZDIR. Iki blok ayri ayri
   taranip tek bir Kasa listesine donusturulur. */

function bankaKasa(satirlar) {
  var liste = [];
  for (var i = 1; i < satirlar.length; i++) {
    var r = satirlar[i];

    var gelir = hamSayi(r[3]);
    if (gelir) {
      var gun = hamTarih(r[0]);
      var metin = [duzMetin(r[1]), duzMetin(r[2])].filter(String).join(' - ');
      if (gun && metin) liste.push({ t: gun, aciklama: metin, tur: 'Gelir', tutar: gelir });
    }

    var gider = hamSayi(r[6]);
    if (gider) {
      var gunG = hamTarih(r[4]);
      var nereye = duzMetin(r[5]);
      if (gunG && nereye) liste.push({ t: gunG, aciklama: nereye, tur: 'Gider', tutar: gider });
    }
  }
  return liste;
}

/* ---------- ham hucre cozucileri ---------- */

/** Tarih hucresi ya gercek tarihtir ya da 6082026 gibi GGAAYYYY sayisidir. */
function hamTarih(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return Utilities.formatDate(v, kitapSaatDilimi(), 'yyyy-MM-dd');

  var s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  var rakam = s.replace(/\D/g, '');
  if (rakam.length === 7) rakam = '0' + rakam;
  if (rakam.length === 8) {
    var gun = rakam.slice(0, 2), ay = rakam.slice(2, 4), yil = rakam.slice(4, 8);
    if (+ay >= 1 && +ay <= 12 && +gun >= 1 && +gun <= 31) return yil + '-' + ay + '-' + gun;
  }
  return gunNormal(s);
}

function hamSayi(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  return sayiCoz(v);
}

function duzMetin(v) {
  if (v == null) return '';
  return String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/* ============================================================
   3) DOGRULAMA — sekmelerdeki gercek veriden 12 rakami hesaplar
   ============================================================ */

function dogrula() {
  var acilis = Number(ayarlariOku().acilis_bakiye) || 0;
  var sip = tabloOku('siparisler');
  var od = tabloOku('odemeler');
  var kasa = tabloOku('kasa');

  var malAlimi = sip.reduce(function (t, r) { return t + r.adet * r.fiyat; }, 0);
  var netBorc = malAlimi - acilis;

  var gelirler = kasa.filter(function (r) { return r.tur === 'Gelir'; });
  var giderler = kasa.filter(function (r) { return r.tur === 'Gider'; });
  var bircanOdeme = giderler.filter(function (r) { return bircanaOdemeMi(r.aciklama); });
  var bircanIs = giderler.filter(function (r) { return bircanIsMasrafiMi(r.aciklama); });
  var diger = giderler.filter(function (r) { return !bircanMi(r.aciklama); });
  var T = function (a) { return a.reduce(function (t, r) { return t + r.tutar; }, 0); };

  var odenenCari = od.reduce(function (t, r) { return t + r.tutar; }, 0);
  var odenenBanka = T(bircanOdeme);
  var odenen = odenenCari + odenenBanka;

  var satirlar = [
    ['Ondan aldigimiz mal', malAlimi, 546560],
    ['Acilis mahsubu', acilis, 0],
    ['Cari defterinden odenen', odenenCari, 68500],
    ['Bankadan odenen', odenenBanka, 219000],
    ['Toplam odenen', odenen, 287500],
    ['KALAN BORCUMUZ', netBorc - odenen, 259060],
    ['Banka geliri', T(gelirler), 671771],
    ['Banka gideri', T(giderler), 476700],
    ["  Bircan'a mal odemesi", odenenBanka, 219000],
    ['  Bircan odeme kaydi', bircanOdeme.length, 9],
    ['  Bircan isi masrafi', T(bircanIs), 47600],
    ['  Bircan isi kaydi', bircanIs.length, 3],
    ['  Diger isletme gideri', T(diger), 210100],
    ['  Diger gider kaydi', diger.length, 27],
    ['NET KASA', T(gelirler) - T(giderler), 195071],
    ['Alim kaydi', sip.length, 3],
    ['Cari odeme kaydi', od.length, 2],
    ['Kasa kaydi', kasa.length, 52]
  ];

  var hata = 0;
  Logger.log('%s  %s  %s', pad('DEGER', 24), pad('HESAPLANAN', 14), pad('BEKLENEN', 12));
  satirlar.forEach(function (s) {
    var tutar = Math.abs(s[1] - s[2]) < 0.005;
    if (!tutar) hata++;
    Logger.log('%s  %s  %s  %s',
      pad(s[0], 24), pad(bicim(s[1]), 14), pad(bicim(s[2]), 12), tutar ? 'OK' : '<<< TUTMUYOR');
  });

  if (hata) {
    Logger.log('!!! %s rakam TUTMUYOR. Uygulamayi kullanmadan once sebebini arastirin.', hata);
  } else {
    Logger.log('Hepsi tuttu (%s/%s). Veri dogru yuklenmis.', satirlar.length, satirlar.length);
  }
  return hata === 0;
}

/* ---------- Bircan siniflandirmasi (web/hesap.js ile birebir ayni kural) ---------- */

/** Turkce I/İ/ı/i hepsi 'i'ye indirgenir; "BIRCAN" ile "Bircan" esitlenir. */
function bircanMi(aciklama) {
  return String(aciklama || '').replace(/[İIıi]/g, 'i').toLowerCase().indexOf('bircan') >= 0;
}

/* ---------- Trendyol yazim duzeltmesi (web/hesap.js ile ayni kural) ---------- */

/** Iki kelime arasindaki duzenleme uzakligi (Levenshtein). */
function uzaklik(a, b) {
  if (a === b) return 0;
  var onceki = [], i, j;
  for (j = 0; j <= b.length; j++) onceki[j] = j;
  for (i = 1; i <= a.length; i++) {
    var simdiki = [i];
    for (j = 1; j <= b.length; j++) {
      simdiki[j] = Math.min(onceki[j] + 1, simdiki[j - 1] + 1,
        onceki[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    }
    onceki = simdiki;
  }
  return onceki[b.length];
}

function normAnahtar(s) {
  return String(s == null ? '' : s).trim()
    .replace(/[İIıi]/g, 'i').toLowerCase().replace(/\s+/g, ' ');
}

/** TRENDYOL / TRENYOL / TREDYOL / Terendyol — hepsi ayni kelimedir. */
function trendyolMu(metin) {
  var kelimeler = normAnahtar(metin).split(/[^a-z0-9çğıöşü]+/);
  for (var i = 0; i < kelimeler.length; i++) {
    if (kelimeler[i].length >= 6 && uzaklik(kelimeler[i], 'trendyol') <= 2) return true;
  }
  return false;
}

/**
 * Trendyol aciklamalarini tek bicime getirir: "<ÖnEk> - TRENDYOL ÖDEME".
 * Onek olarak o gruptaki EN SIK kullanilan yazim secilir; yeni bir ad
 * UYDURULMAZ. SLAW REZZ ile Dummy ayri gruplardir.
 * Degistirilen satirlarin [eski, yeni] listesini dondurur.
 */
function trendyolYazimlariniDuzelt(kasa) {
  var gruplar = {};
  kasa.forEach(function (r) {
    if (!trendyolMu(r.aciklama)) return;
    var onEk = String(r.aciklama).split(/\s+-\s+/)[0].trim();
    var anahtar = normAnahtar(onEk).replace(/\s+/g, '');
    if (!gruplar[anahtar]) gruplar[anahtar] = {};
    gruplar[anahtar][onEk] = (gruplar[anahtar][onEk] || 0) + 1;
  });

  var secim = {};
  Object.keys(gruplar).forEach(function (anahtar) {
    var enSik = null, enCok = -1;
    Object.keys(gruplar[anahtar]).forEach(function (yazim) {
      if (gruplar[anahtar][yazim] > enCok) { enCok = gruplar[anahtar][yazim]; enSik = yazim; }
    });
    secim[anahtar] = enSik;
  });

  var degisenler = [];
  kasa.forEach(function (r) {
    if (!trendyolMu(r.aciklama)) return;
    var onEk = String(r.aciklama).split(/\s+-\s+/)[0].trim();
    var yeni = secim[normAnahtar(onEk).replace(/\s+/g, '')] + ' - TRENDYOL ÖDEME';
    if (yeni !== r.aciklama) {
      degisenler.push([r.aciklama, yeni]);
      r.aciklama = yeni;
    }
  });
  return degisenler;
}

/** Dogrudan Bircan'in kendisine yapilan odeme — BORCU DUSER. */
function bircanaOdemeMi(aciklama) {
  return bircanMi(aciklama) && String(aciklama || '').indexOf('[') < 0;
}

/** Bircan isi icin ucuncu kisiye odenen masraf — borcu DUSURMEZ. */
function bircanIsMasrafiMi(aciklama) {
  return bircanMi(aciklama) && String(aciklama || '').indexOf('[') >= 0;
}

function pad(s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s;
}

function bicim(v) {
  return (Math.abs(v) >= 1000)
    ? Utilities.formatString('%s', Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    : String(v);
}
