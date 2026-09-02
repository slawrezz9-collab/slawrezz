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
   DIKKAT: "bircan abi2026" dosyasi BANKA HESABI verisini tutar; adi yanilticidir.
   Cari (Bircan'dan mal alimi) verisi "SLAWREZZ_Musteri_Takip- BIRCAN"dadir. */
var HAM_CARI = 'SLAWREZZ_Musteri_Takip- BİRCAN';
var HAM_BANKA = 'bircan abi2026';

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
    s.getRange(1, 1, 1, cfg.basliklar.length).createTextFinder(''); // no-op, bicim korunur
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

/** Ham dosyayi Drive'da adiyla bulur ve ilk sekmesinin tamamini dondurur. */
function hamOku(dosyaAdi) {
  var bulunan = DriveApp.getFilesByName(dosyaAdi);
  if (!bulunan.hasNext()) {
    throw new Error(
      '"' + dosyaAdi + '" adlı dosya Drive\'da bulunamadı. ' +
      'Dosyayı yüklediğinizden ve Google E-Tablolar olarak açtığınızdan emin olun ' +
      '(adında .xlsx uzantısı kalmamalı).'
    );
  }
  var dosya = bulunan.next();
  var kit;
  try {
    kit = SpreadsheetApp.openById(dosya.getId());
  } catch (h) {
    throw new Error(
      '"' + dosyaAdi + '" henüz Google E-Tablolar biçiminde değil. ' +
      'Drive\'da dosyaya çift tıklayıp Dosya > Google E-Tablolar olarak kaydet deyin.'
    );
  }
  return kit.getSheets()[0].getDataRange().getValues();
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

/* ---------- bircan abi2026 (BANKA HESABI): A-D gelir, E-G gider ----------
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
