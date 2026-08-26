# -*- coding: utf-8 -*-
"""Trendyol ürün sayfalarındaki değerlendirmeleri toplar.

Her modelin ürün sayfasındaki schema.org JSON-LD bloğundan ortalama puan,
değerlendirme sayısı ve yorum metinlerini (maskeli isimlerle) çıkarır.
Çıktı: veri/yorumlar.json  →  site "Trendyol değerlendirmeleri" bölümünde,
kaynak belirterek gösterir.

Kullanım:  python yorum_aktar.py
"""
import json
import os
import re
import time

import requests

KOK = os.path.dirname(os.path.abspath(__file__))
GIRDI = os.path.join(KOK, "veri", "urunler.json")
CIKTI = os.path.join(KOK, "veri", "yorumlar.json")

H = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept-Language": "tr-TR,tr;q=0.9",
}


def jsonld_bloklari(html):
    for m in re.finditer(
            r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
            html, re.S):
        try:
            yield json.loads(m.group(1))
        except json.JSONDecodeError:
            continue


def urun_yorumlari(url):
    r = requests.get(url.split("?")[0], headers=H, timeout=20)
    if r.status_code != 200:
        return None
    for blok in jsonld_bloklari(r.text):
        adaylar = blok if isinstance(blok, list) else [blok]
        for b in adaylar:
            if not isinstance(b, dict) or "aggregateRating" not in b:
                continue
            ar = b.get("aggregateRating") or {}
            yorumlar = []
            for y in b.get("review", []) or []:
                puan = ((y.get("reviewRating") or {}).get("ratingValue"))
                yorumlar.append({
                    "ad": (y.get("author") or {}).get("name", "").strip() or "****",
                    "tarih": y.get("datePublished", ""),
                    "puan": float(puan) if puan is not None else None,
                    "metin": (y.get("reviewBody") or "").strip(),
                })
            return {
                "ortalama": float(ar.get("ratingValue", 0) or 0),
                "sayi": int(ar.get("ratingCount", 0) or 0),
                "yorumlar": [y for y in yorumlar if y["metin"]],
            }
    return None


if __name__ == "__main__":
    with open(GIRDI, encoding="utf-8") as f:
        modeller = json.load(f)["modeller"]

    # devam modu: mevcut çıktı korunur, yalnızca eksik modeller çekilir
    sonuc, islenmis = {}, set()
    if os.path.exists(CIKTI):
        with open(CIKTI, encoding="utf-8") as f:
            eski = json.load(f)
        sonuc = eski.get("urunler", {})
        islenmis = set(eski.get("islenmis", []) or sonuc.keys())

    hata = 0
    for i, m in enumerate(modeller, 1):
        url = m.get("trendyolUrl")
        if not url or m["id"] in islenmis:
            continue
        v, basarili = None, False
        for deneme in range(2):
            try:
                v = urun_yorumlari(url)
                basarili = True  # sayfa alındı (yorum bloğu olmasa bile işlendi sayılır)
                break
            except Exception as e:
                if deneme == 0:
                    print(f"{i}/{len(modeller)}  bağlantı hatası — 30sn bekleniyor")
                    time.sleep(30)
                else:
                    hata += 1
                    print(f"{i}/{len(modeller)}  HATA: {str(e)[:60]}")
        if basarili:
            islenmis.add(m["id"])
            if v and v["sayi"] > 0:
                sonuc[m["id"]] = v
            print(f"{i}/{len(modeller)}  {m['id'][:44]:44}  "
                  f"{(str(v['sayi']) + ' dgr, ' + str(len(v['yorumlar'])) + ' yorum') if v and v['sayi'] else '-'}")
        time.sleep(1.2)

    toplam_dgr = sum(v["sayi"] for v in sonuc.values())
    agirlikli = (sum(v["ortalama"] * v["sayi"] for v in sonuc.values()) / toplam_dgr
                 if toplam_dgr else 0)
    with open(CIKTI, "w", encoding="utf-8") as f:
        json.dump({
            "guncelleme": time.strftime("%Y-%m-%d"),
            "magaza": {"ortalama": round(agirlikli, 1), "toplam": toplam_dgr},
            "islenmis": sorted(islenmis),
            "urunler": sonuc,
        }, f, ensure_ascii=False, indent=1)
    print(f"\nBitti: {len(sonuc)} yorumlu urun, toplam {toplam_dgr} degerlendirme, "
          f"magaza ortalamasi {agirlikli:.1f} (hata: {hata}) -> {CIKTI}")
