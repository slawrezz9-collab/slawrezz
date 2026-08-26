/* SLAW REZZ — veri katmanı + sepet + ortak arayüz
 * Veri önceliği: Supabase (yapılandırılmışsa) → veri/urunler.json.
 * Admin panelindeki yerel düzenlemeler localStorage overlay olarak uygulanır;
 * Supabase devreye girince overlay yerine doğrudan veritabanı kullanılır. */
(function () {
  const C = window.SLAW_CONFIG || {};
  const KOK = document.body.dataset.kok || ""; // alt klasör sayfaları "../" verir

  // ---------- yardımcılar ----------
  const para = (t) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(t || 0);

  const supabaseAktif = () => !!(C.supabaseUrl && C.supabaseAnonKey && window.supabase);
  let sb = null;
  if (supabaseAktif()) sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);

  // ---------- ürün verisi ----------
  let _modeller = null;

  // yerel görsel yolları (gorseller/...) alt klasör sayfalarında da çalışsın
  const gorselYolu = (g) => /^(https?:|data:|\/)/.test(g) ? g : KOK + g;
  const gorselleriDuzelt = (liste) => {
    liste.forEach((m) => { m.gorseller = (m.gorseller || []).map(gorselYolu); });
    return liste;
  };

  async function urunleriGetir() {
    if (_modeller) return _modeller;
    if (sb) {
      const { data, error } = await sb.from("urunler").select("*").order("sira");
      if (!error && data && data.length) {
        _modeller = gorselleriDuzelt(data.map(satirdanModel));
        return _modeller;
      }
    }
    const r = await fetch(KOK + "veri/urunler.json");
    const d = await r.json();
    let liste = d.modeller || [];
    // yerel admin düzenlemeleri
    try {
      const ov = JSON.parse(localStorage.getItem("slaw_admin_overlay") || "{}");
      liste = liste
        .filter((m) => !(ov.silinen || []).includes(m.id))
        .map((m) => Object.assign({}, m, (ov.duzenleme || {})[m.id] || {}));
      liste = liste.concat(ov.yeni || []);
    } catch (e) {}
    _modeller = gorselleriDuzelt(liste);
    return _modeller;
  }

  function satirdanModel(s) {
    return {
      id: s.id, ad: s.ad, kategori: s.kategori, aciklama: s.aciklama,
      listeFiyat: Number(s.liste_fiyat), satisFiyat: Number(s.satis_fiyat),
      gorseller: s.gorseller || [], bedenler: s.bedenler || {},
      ozellikler: s.ozellikler || {},
      toplamStok: s.toplam_stok, aktif: s.aktif, flas: !!s.flas,
      renk: s.renk || "", trendyolUrl: s.trendyol_url,
    };
  }

  // ---------- indirim etiketi ----------
  // %5–7,5 → Avantajlı Ürün | %7,5–10 → Çok Avantajlı Ürün | %10+ → Süper Avantaj
  function indirimBilgi(m) {
    if (!m || !(m.listeFiyat > m.satisFiyat)) return null;
    const y = (m.listeFiyat - m.satisFiyat) / m.listeFiyat * 100;
    let etiket = null, sinif = "";
    if (y >= 10) { etiket = "Süper Avantaj"; sinif = "super"; }
    else if (y >= 7.5) { etiket = "Çok Avantajlı Ürün"; sinif = "cok"; }
    else if (y >= 5) { etiket = "Avantajlı Ürün"; sinif = "avantaj"; }
    return { yuzde: Math.round(y), etiket, sinif };
  }

  // ---------- renk varyantı gruplama ----------
  // Aynı modelin farklı renkleri ayrı kayıt olarak gelir; ad içindeki renk
  // kelimeleri temizlenerek aynı gruba bağlanır.
  const RENKLER = ["pembe", "siyah", "beyaz", "kırmızı", "kirmizi", "bordo", "gri",
    "bej", "lacivert", "mavi", "yeşil", "yesil", "mor", "lila", "kahverengi",
    "vizon", "ekru", "krem", "sarı", "sari", "turuncu", "haki", "antrasit",
    "füme", "fume", "pudra", "gold", "gümüş", "gumus", "taş", "tas", "mürdüm",
    "murdum", "petrol", "mint", "somon", "fuşya", "fusya", "leopar", "zebra"];
  function grupAnahtari(m) {
    let ad = (m.ad || "").toLocaleLowerCase("tr");
    RENKLER.forEach((r) => { ad = ad.split(r).join(" "); });
    return (m.kategori || "") + "|" + ad.replace(/[^a-zçğıöşü0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function renkAdi(m) {
    const oz = m.ozellikler && (m.ozellikler.Renk || m.ozellikler.renk);
    if (oz) return oz;
    const ad = (m.ad || "").toLocaleLowerCase("tr");
    const r = RENKLER.find((x) => ad.includes(x));
    return r ? r.charAt(0).toLocaleUpperCase("tr") + r.slice(1) : "Standart";
  }

  // ---------- ziyaret & gösterim sayacı ----------
  async function olayKaydet(tip, urunId) {
    try {
      if (sb) { await sb.from("olaylar").insert({ tip, urun_id: urunId || null }); return; }
      const l = JSON.parse(localStorage.getItem("slaw_olaylar") || "[]");
      l.push({ tip, urun_id: urunId || null, t: Date.now() });
      if (l.length > 20000) l.splice(0, l.length - 20000);
      localStorage.setItem("slaw_olaylar", JSON.stringify(l));
    } catch (e) { /* sayaç hatası siteyi etkilemesin */ }
  }
  async function olaylariGetir() {
    if (sb) {
      const { data } = await sb.from("olaylar").select("tip,urun_id,created_at");
      return (data || []).map((o) => ({ tip: o.tip, urun_id: o.urun_id, t: +new Date(o.created_at) }));
    }
    return JSON.parse(localStorage.getItem("slaw_olaylar") || "[]");
  }

  async function urunGetir(id) {
    const hepsi = await urunleriGetir();
    return hepsi.find((m) => m.id === id);
  }

  // ---------- değerlendirmeler (kaynak: Trendyol, maskeli isimlerle) ----------
  let _yorumlar = null;
  async function yorumlariGetir() {
    if (_yorumlar) return _yorumlar;
    try {
      const r = await fetch(KOK + "veri/yorumlar.json");
      _yorumlar = r.ok ? await r.json() : { magaza: {}, urunler: {} };
    } catch (e) { _yorumlar = { magaza: {}, urunler: {} }; }
    return _yorumlar;
  }
  const yildizlar = (p) => "★".repeat(Math.round(p)) + "☆".repeat(5 - Math.round(p));

  // Trendyol'dan aktarılan hazır soru-cevaplar (veri/sorular.json)
  let _hazirSorular = null;
  async function hazirSorulariGetir() {
    if (_hazirSorular) return _hazirSorular;
    try {
      const r = await fetch(KOK + "veri/sorular.json");
      _hazirSorular = r.ok ? await r.json() : { urunler: {} };
    } catch (e) { _hazirSorular = { urunler: {} }; }
    return _hazirSorular;
  }

  // ---------- soru & cevap ----------
  async function sorulariGetir(urunId) {
    if (sb) {
      const s = sb.from("sorular").select("*").order("created_at", { ascending: false });
      const { data } = urunId ? await s.eq("urun_id", urunId) : await s;
      return data || [];
    }
    const hepsi = JSON.parse(localStorage.getItem("slaw_sorular") || "[]");
    return urunId ? hepsi.filter((s) => s.urun_id === urunId) : hepsi;
  }
  async function soruSor(urunId, metin, misafirAd) {
    if (sb) {
      const kullanici = (await sb.auth.getUser()).data.user;
      if (!kullanici) throw new Error("giris_gerekli");
      const { error } = await sb.from("sorular").insert({
        urun_id: urunId, kullanici_id: kullanici.id, soru: metin,
      });
      if (error) throw error;
    } else {
      const hepsi = JSON.parse(localStorage.getItem("slaw_sorular") || "[]");
      hepsi.unshift({
        id: "q" + Date.now(), urun_id: urunId, soru: metin,
        misafir_ad: misafirAd || "Misafir", cevap: null, yayinda: false,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem("slaw_sorular", JSON.stringify(hepsi));
    }
  }
  async function soruGuncelle(id, alanlar) {
    if (sb) { await sb.from("sorular").update(alanlar).eq("id", id); }
    else {
      const hepsi = JSON.parse(localStorage.getItem("slaw_sorular") || "[]");
      Object.assign(hepsi.find((s) => s.id === id) || {}, alanlar);
      localStorage.setItem("slaw_sorular", JSON.stringify(hepsi));
    }
  }
  async function soruSil(id) {
    if (sb) { await sb.from("sorular").delete().eq("id", id); }
    else {
      const hepsi = JSON.parse(localStorage.getItem("slaw_sorular") || "[]")
        .filter((s) => s.id !== id);
      localStorage.setItem("slaw_sorular", JSON.stringify(hepsi));
    }
  }

  // ---------- sepet ----------
  const sepetOku = () => {
    try { return JSON.parse(localStorage.getItem("slaw_sepet") || "[]"); }
    catch (e) { return []; }
  };
  const sepetYaz = (s) => {
    localStorage.setItem("slaw_sepet", JSON.stringify(s));
    sayacGuncelle();
  };
  function sepeteEkle(id, beden, adet) {
    const s = sepetOku();
    const var_ = s.find((k) => k.id === id && k.beden === beden);
    if (var_) var_.adet += adet; else s.push({ id, beden, adet });
    sepetYaz(s);
  }
  function sepettenCikar(id, beden) {
    sepetYaz(sepetOku().filter((k) => !(k.id === id && k.beden === beden)));
  }
  function adetAyarla(id, beden, adet) {
    const s = sepetOku();
    const k = s.find((x) => x.id === id && x.beden === beden);
    if (k) { k.adet = Math.max(1, adet); sepetYaz(s); }
  }
  function sayacGuncelle() {
    const n = sepetOku().reduce((t, k) => t + k.adet, 0);
    document.querySelectorAll(".sepet-sayac").forEach((e) => {
      e.textContent = n; e.style.display = n ? "flex" : "none";
    });
  }

  async function sepetDetay() {
    await ayarlariUygula(); // kargo ücreti/limit ayarlardan gelmiş olabilir
    const s = sepetOku();
    const satirlar = [];
    for (const k of s) {
      const u = await urunGetir(k.id);
      if (u) satirlar.push({ ...k, urun: u, tutar: u.satisFiyat * k.adet });
    }
    const araToplam = satirlar.reduce((t, x) => t + x.tutar, 0);
    const kargo = araToplam === 0 || araToplam >= (C.ucretsizKargoLimiti || 1500)
      ? 0 : (C.kargoUcreti || 0);
    return { satirlar, araToplam, kargo, toplam: araToplam + kargo };
  }

  // ---------- mağaza ayarları (tasarım/yapılandırma) ----------
  const TEMALAR = {
    varsayilan: { ad: "Krem & Gül (varsayılan)", vars: {} },
    gece: { ad: "Gece & Altın", vars: {
      "--krem": "#151217", "--krem-koyu": "#211d24", "--murekkep": "#f2ecdf",
      "--murekkep-yum": "#b3a795", "--gul": "#d4a437", "--gul-acik": "#3a3020",
      "--cizgi": "#343039", "--beyaz": "#1c181f" } },
    fildisi: { ad: "Fildişi & Siyah", vars: {
      "--krem": "#faf8f4", "--krem-koyu": "#efeae1", "--murekkep": "#121212",
      "--murekkep-yum": "#585858", "--gul": "#1a1a1a", "--gul-acik": "#e9e4da",
      "--cizgi": "#dcd5c8", "--beyaz": "#ffffff" } },
    pudra: { ad: "Pudra & Bordo", vars: {
      "--krem": "#f7edea", "--krem-koyu": "#efdcd7", "--murekkep": "#2b1219",
      "--murekkep-yum": "#6d4a52", "--gul": "#7c1f3a", "--gul-acik": "#f0d3da",
      "--cizgi": "#e0c8c2", "--beyaz": "#fdf8f6" } },
  };
  let _ayarlar = null;
  async function ayarlariGetir() {
    if (_ayarlar) return _ayarlar;
    if (sb) {
      const { data } = await sb.from("ayarlar").select("deger").eq("anahtar", "site").maybeSingle();
      _ayarlar = (data && data.deger) || {};
    } else {
      _ayarlar = JSON.parse(localStorage.getItem("slaw_ayarlar") || "{}");
    }
    return _ayarlar;
  }
  async function ayarlarKaydet(obj) {
    const a = Object.assign({}, await ayarlariGetir(), obj);
    Object.keys(a).forEach((k) => { if (a[k] === "" || a[k] == null) delete a[k]; });
    _ayarlar = a;
    if (sb) {
      const { error } = await sb.from("ayarlar").upsert({ anahtar: "site", deger: a });
      if (error) throw error;
    } else localStorage.setItem("slaw_ayarlar", JSON.stringify(a));
  }
  async function ayarlarSifirla() {
    _ayarlar = {};
    if (sb) await sb.from("ayarlar").delete().eq("anahtar", "site");
    else localStorage.removeItem("slaw_ayarlar");
  }
  async function ayarlariUygula() {
    const a = await ayarlariGetir();
    const r = document.documentElement;
    const t = TEMALAR[a.tema];
    if (t) Object.entries(t.vars).forEach(([k, v]) => r.style.setProperty(k, v));
    if (a.vurguRenk) r.style.setProperty("--gul", a.vurguRenk);
    if (a.duyuru) document.querySelectorAll(".duyuru").forEach((e) => (e.textContent = a.duyuru));
    if (a.kargoUcreti != null) C.kargoUcreti = +a.kargoUcreti;
    if (a.kargoLimit != null) C.ucretsizKargoLimiti = +a.kargoLimit;
    if (a.whatsapp) C.whatsapp = String(a.whatsapp).replace(/\D/g, "");
    return a;
  }

  // ---------- kuponlar ----------
  async function kuponlariGetir() {
    if (sb) {
      const { data } = await sb.from("kuponlar").select("*").order("created_at", { ascending: false });
      return data || [];
    }
    return JSON.parse(localStorage.getItem("slaw_kuponlar") || "[]");
  }
  async function kuponDogrula(kod, araToplam) {
    const k = (await kuponlariGetir()).find(
      (x) => x.kod.toUpperCase() === kod.toUpperCase() && x.aktif);
    if (!k) throw new Error("Kupon kodu geçersiz.");
    if (araToplam < (k.min_sepet || 0))
      throw new Error(`Bu kupon ${para(k.min_sepet)} ve üzeri sepetlerde geçerli.`);
    const indirim = k.tip === "yuzde"
      ? araToplam * k.deger / 100 : Math.min(k.deger, araToplam);
    return { kod: k.kod, indirim: Math.round(indirim * 100) / 100 };
  }
  async function kuponKaydet(kupon) {
    if (sb) {
      const { error } = await sb.from("kuponlar").upsert(kupon);
      if (error) throw error;
    } else {
      const l = JSON.parse(localStorage.getItem("slaw_kuponlar") || "[]")
        .filter((x) => x.kod !== kupon.kod);
      l.unshift(Object.assign({ created_at: new Date().toISOString() }, kupon));
      localStorage.setItem("slaw_kuponlar", JSON.stringify(l));
    }
  }
  async function kuponSil(kod) {
    if (sb) { await sb.from("kuponlar").delete().eq("kod", kod); }
    else {
      const l = JSON.parse(localStorage.getItem("slaw_kuponlar") || "[]")
        .filter((x) => x.kod !== kod);
      localStorage.setItem("slaw_kuponlar", JSON.stringify(l));
    }
  }

  // ---------- WhatsApp sipariş ----------
  function whatsappLinki(metin) {
    return "https://wa.me/" + (C.whatsapp || "") + "?text=" + encodeURIComponent(metin);
  }
  async function whatsappSiparisLinki() {
    const d = await sepetDetay();
    let m = "Merhaba, siparis vermek istiyorum:\n";
    d.satirlar.forEach((s) => {
      m += `\n- ${s.urun.ad} | Beden: ${s.beden} | Adet: ${s.adet} | ${para(s.tutar)}`;
    });
    m += `\n\nToplam: ${para(d.toplam)} (kargo ${d.kargo ? para(d.kargo) : "ücretsiz"})`;
    return whatsappLinki(m);
  }

  // ---------- sipariş durumları (TEK KAYNAK) ----------
  // Daha önce bu harita admin panelinde, hesap sayfasında ve schema.sql yorumunda
  // ayrı ayrı duruyordu ve senkron değildi. Artık tek yer burası.
  const DURUMLAR = {
    odeme_bekliyor: { admin: "Ödeme Bekliyor", musteri: "Ödeme Bekleniyor",  renk: "#b3a795", adim: 0 },
    odendi:         { admin: "Yeni",           musteri: "Siparişiniz Alındı", renk: "#2f9e44", adim: 1 },
    hazirlaniyor:   { admin: "Hazırlanıyor",   musteri: "Hazırlanıyor",       renk: "#f0b429", adim: 2 },
    kargoda:        { admin: "Kargoda",        musteri: "Kargoya Verildi",    renk: "#1971c2", adim: 3 },
    teslim:         { admin: "Teslim Edilen",  musteri: "Teslim Edildi",      renk: "#2f9e44", adim: 4 },
    iade:           { admin: "İade",           musteri: "İade Edildi",        renk: "#a33",    adim: -1 },
    iptal:          { admin: "İptal",          musteri: "İptal Edildi",       renk: "#888",    adim: -1 },
  };
  const SIRADAKI = { odendi: "hazirlaniyor", hazirlaniyor: "kargoda", kargoda: "teslim" };

  const IADE_DURUMLARI = {
    talep_edildi: { admin: "Talep Edildi", musteri: "Talebiniz Alındı",          renk: "#f0b429" },
    onaylandi:    { admin: "Onaylandı",    musteri: "Onaylandı — Kargoya Verin", renk: "#1971c2" },
    reddedildi:   { admin: "Reddedildi",   musteri: "Reddedildi",                renk: "#a33" },
    kargoda:      { admin: "Yolda",        musteri: "Ürün Bize Doğru Yolda",     renk: "#1971c2" },
    tamamlandi:   { admin: "Tamamlandı",   musteri: "İadeniz Tamamlandı",        renk: "#2f9e44" },
  };

  // Düz {kod: ad} haritası döndürür — mevcut kodun DURUMLAR[s.durum] kullanımı bozulmasın diye.
  function durumHaritasi(kim, kaynak) {
    const k = kaynak === "iade" ? IADE_DURUMLARI : DURUMLAR;
    return Object.fromEntries(Object.entries(k).map(([kod, v]) => [kod, v[kim] || v.admin]));
  }
  const durumAdi = (kod, kim, kaynak) => durumHaritasi(kim || "musteri", kaynak)[kod] || kod;
  const durumRengi = (kod, kaynak) =>
    ((kaynak === "iade" ? IADE_DURUMLARI : DURUMLAR)[kod] || {}).renk || "var(--gul)";

  // ---------- satıcı künyesi (TEK KAYNAK: config.satici) ----------
  const S = C.satici || {};
  const SATICI_TUREV = {
    tamAdres: () => [S.adres, S.ilce, S.il].filter(Boolean).join(" / "),
    vergiSatiri: () => [
      S.vergiDairesi && S.vergiDairesi + " V.D.",
      S.vergiNo && "VKN/TCKN: " + S.vergiNo,
    ].filter(Boolean).join(" — "),
    kunye: () => [S.unvan, SATICI_TUREV.tamAdres(), SATICI_TUREV.vergiSatiri(),
                  S.telefon, S.eposta].filter(Boolean).join(", "),
  };
  function saticiAlan(yol) {
    if (SATICI_TUREV[yol]) return SATICI_TUREV[yol]();
    return String(yol).split(".").reduce((o, k) => (o == null ? o : o[k]), S);
  }
  // data-yil deseninin kardeşi: <span data-satici="unvan"></span> doldurur.
  function saticiyiBas(kapsam) {
    const k = kapsam || document;
    // değer boşsa bloğu tamamen kaldır (MERSİS gibi opsiyonel alanlar için)
    k.querySelectorAll("[data-satici-varsa]").forEach((e) => {
      if (!saticiAlan(e.dataset.saticiVarsa)) e.remove();
    });
    k.querySelectorAll("[data-satici]").forEach((e) => {
      const v = saticiAlan(e.dataset.satici);
      e.textContent = v || "[EKLENECEK]";
      if (e.hasAttribute("data-satici-mailto") && v) e.href = "mailto:" + v;
      if (e.hasAttribute("data-satici-tel") && v) e.href = "tel:" + String(v).replace(/\D/g, "");
    });
    // ödeme sağlayıcı etiketi (hukuk metinlerinde geçiyor)
    const etiket = C.odemeSaglayici === "paytr" ? "PayTR" : "iyzico";
    k.querySelectorAll("[data-odeme-saglayici]").forEach((e) => (e.textContent = etiket));
  }
  // ETBİS kayıt rozeti — numara girilmemişse hiç render edilmez.
  function etbisRozeti() {
    if (!S.etbisNo) return;
    document.querySelectorAll("footer .telif").forEach((t) => {
      const s = document.createElement("span");
      s.className = "etbis-rozet";
      s.innerHTML = S.etbisQr
        ? `<a href="${S.etbisUrl || "#"}" target="_blank" rel="noopener">
             <img src="${KOK + S.etbisQr}" alt="ETBİS Kayıtlı E-Ticaret Sitesi" style="height:44px;vertical-align:middle"></a>`
        : `ETBİS Kayıt No: ${S.etbisNo}`;
      t.appendChild(s);
    });
  }

  // ---------- üyelik ----------
  const auth = {
    aktif: () => !!sb,
    kayit: (email, sifre, ad) =>
      sb.auth.signUp({ email, password: sifre, options: { data: { ad } } }),
    giris: (email, sifre) => sb.auth.signInWithPassword({ email, password: sifre }),
    cikis: () => sb.auth.signOut(),
    kullanici: async () => sb ? (await sb.auth.getUser()).data.user : null,
  };

  // ---------- Meta Pixel ----------
  function pixelYukle() {
    if (!C.metaPixelId) return;
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0";
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", C.metaPixelId);
    fbq("track", "PageView");
  }
  function pixelOlay(ad, veri) { if (window.fbq) fbq("track", ad, veri || {}); }

  // ---------- çerez bandı ----------
  function cerezBandi() {
    if (localStorage.getItem("slaw_cerez_onay")) { pixelYukle(); return; }
    const b = document.createElement("div");
    b.className = "cerez-bant acik";
    b.innerHTML =
      '<span>Deneyiminizi iyileştirmek ve reklam ölçümü için çerez kullanıyoruz. ' +
      'Detay: <a href="' + KOK + 'hukuk/cerez.html" style="text-decoration:underline">Çerez Politikası</a></span>' +
      '<button class="buton" id="cerezKabul">Kabul Et</button>' +
      '<button class="buton ikincil" id="cerezRed" style="border-color:var(--krem);color:var(--krem)">Reddet</button>';
    document.body.appendChild(b);
    b.querySelector("#cerezKabul").onclick = () => {
      localStorage.setItem("slaw_cerez_onay", "evet"); b.remove(); pixelYukle();
    };
    b.querySelector("#cerezRed").onclick = () => {
      localStorage.setItem("slaw_cerez_onay", "hayir"); b.remove();
    };
    if (localStorage.getItem("slaw_cerez_onay") === "evet") pixelYukle();
  }

  // ---------- mobil menü (hamburger) ----------
  function mobilMenuKur() {
    const bar = document.querySelector(".ustbar");
    if (!bar || !bar.querySelector(".menu")) return; // admin panelinde menü yok
    const dugme = document.createElement("button");
    dugme.className = "menu-dugme";
    dugme.setAttribute("aria-label", "menüyü aç");
    dugme.textContent = "☰";
    bar.appendChild(dugme);
    const panel = document.createElement("nav");
    panel.className = "mobil-menu";
    panel.innerHTML = `
      <button class="kapat" aria-label="menüyü kapat">✕</button>
      <a href="${KOK}index.html">Mağaza</a>
      <a href="${KOK}index.html#koleksiyon">Koleksiyon</a>
      <a href="${KOK}hesap.html">Hesabım</a>
      <a href="${KOK}sepet.html">Sepetim</a>
      <a href="${KOK}hukuk/iade.html">İade &amp; Kargo</a>
      <a href="${KOK}hukuk/iletisim.html">İletişim</a>`;
    document.body.appendChild(panel);
    const kapat = () => panel.classList.remove("acik");
    dugme.onclick = () => panel.classList.add("acik");
    panel.querySelector(".kapat").onclick = kapat;
    panel.querySelectorAll("a").forEach((a) => (a.onclick = kapat));
  }

  document.addEventListener("DOMContentLoaded", () => {
    sayacGuncelle();
    cerezBandi();
    ayarlariUygula();
    mobilMenuKur();
    document.querySelectorAll("[data-yil]").forEach((e) => (e.textContent = new Date().getFullYear()));
    saticiyiBas();
    etbisRozeti();
  });

  window.SLAW = {
    para, urunleriGetir, urunGetir, sepetOku, sepeteEkle, sepettenCikar,
    adetAyarla, sepetDetay, whatsappLinki, whatsappSiparisLinki, auth,
    yorumlariGetir, yildizlar, sorulariGetir, soruSor, soruGuncelle, soruSil,
    hazirSorulariGetir,
    kuponlariGetir, kuponDogrula, kuponKaydet, kuponSil,
    indirimBilgi, grupAnahtari, renkAdi, olayKaydet, olaylariGetir,
    TEMALAR, ayarlariGetir, ayarlarKaydet, ayarlarSifirla, ayarlariUygula,
    DURUMLAR, SIRADAKI, IADE_DURUMLARI, durumHaritasi, durumAdi, durumRengi,
    satici: S, saticiAlan, saticiyiBas,
    pixelOlay, sb: () => sb, config: C, KOK,
  };
})();
