# -*- coding: utf-8 -*-
"""Ürün görsellerini Trendyol CDN'inden yerel depoya taşır.

- Model başına en fazla 14 görsel indirilir (site en fazla bunu gösterir)
- Uzun kenar 1600px'e küçültülür, JPEG %80 kalitede sıkıştırılır
- urunler.json yolları gorseller/<model-id>/<n>.jpg olarak güncellenir
- Kaldığı yerden devam eder (mevcut dosyalar atlanır)
- Orijinal URL'ler veri/urunler.orijinal-url.json yedeğinde saklanır

Kullanım:  python gorsel_tasi.py
"""
import io
import json
import os
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from PIL import Image

KOK = os.path.dirname(os.path.abspath(__file__))
GIRDI = os.path.join(KOK, "veri", "urunler.json")
YEDEK = os.path.join(KOK, "veri", "urunler.orijinal-url.json")
DIZIN = os.path.join(KOK, "gorseller")
MAKS_GORSEL = 14
MAKS_KENAR = 1600
KALITE = 80
ISCI = 6

oturum = requests.Session()
oturum.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                                     "AppleWebKit/537.36 Chrome/126.0 Safari/537.36"})


def indir_optimize(url, hedef):
    if os.path.exists(hedef):
        return "var"
    r = oturum.get(url, timeout=40)
    r.raise_for_status()
    img = Image.open(io.BytesIO(r.content)).convert("RGB")
    img.thumbnail((MAKS_KENAR, MAKS_KENAR), Image.LANCZOS)
    os.makedirs(os.path.dirname(hedef), exist_ok=True)
    img.save(hedef, "JPEG", quality=KALITE, optimize=True, progressive=True)
    return "indi"


if __name__ == "__main__":
    with open(GIRDI, encoding="utf-8") as f:
        veri = json.load(f)
    if not os.path.exists(YEDEK):
        shutil.copy(GIRDI, YEDEK)
        print("Orijinal URL yedeği alındı:", YEDEK)

    isler = []  # (model, index, url, hedef)
    for m in veri["modeller"]:
        for i, url in enumerate(m.get("gorseller", [])[:MAKS_GORSEL]):
            if not str(url).startswith("http"):
                continue  # zaten yerel/data
            hedef = os.path.join(DIZIN, m["id"], f"{i}.jpg")
            isler.append((m, i, url, hedef))

    print(f"{len(isler)} görsel işlenecek ({ISCI} paralel)...")
    basari, hata = {}, 0
    with ThreadPoolExecutor(max_workers=ISCI) as havuz:
        gelecekler = {havuz.submit(indir_optimize, u, h): (m, i, h)
                      for (m, i, u, h) in isler}
        for say, g in enumerate(as_completed(gelecekler), 1):
            m, i, hedef = gelecekler[g]
            try:
                g.result()
                basari.setdefault(m["id"], set()).add(i)
            except Exception as e:
                hata += 1
                if hata <= 10:
                    print(f"  HATA {m['id'][:36]}/{i}: {str(e)[:50]}")
            if say % 250 == 0:
                print(f"  {say}/{len(isler)} tamamlandı (hata: {hata})")

    # yolları güncelle: indirilen yerel, indirilemeyenler orijinal URL kalır
    for m in veri["modeller"]:
        eskiler = m.get("gorseller", [])[:MAKS_GORSEL]
        inenler = basari.get(m["id"], set())
        m["gorseller"] = [
            f"gorseller/{m['id']}/{i}.jpg" if (i in inenler or
                os.path.exists(os.path.join(DIZIN, m["id"], f"{i}.jpg")))
            else g
            for i, g in enumerate(eskiler)
        ]
    with open(GIRDI, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, indent=1)

    boyut = sum(os.path.getsize(os.path.join(dp, f))
                for dp, _, fs in os.walk(DIZIN) for f in fs) / 1e6
    print(f"Bitti: {len(isler) - hata} görsel yerel, hata: {hata}, "
          f"toplam boyut: {boyut:.0f} MB")
    if hata:
        print("Not: script tekrar çalıştırılırsa yalnızca eksikler denenir.")
