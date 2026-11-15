import hashlib
import json
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import mktime
from zoneinfo import ZoneInfo

import feedparser
import requests
from bs4 import BeautifulSoup

ROME_TZ = ZoneInfo("Europe/Rome")
DATA_DIR = Path("data")
ARCHIVE_DIR = DATA_DIR / "archive"

FEEDS = [
    # Fonti Italiane
    {"name": "AI4Business", "url": "https://www.ai4business.it/feed/", "category": "Italia", "lang": "it", "max_items": 10},
    {"name": "Agenda Digitale", "url": "https://www.agendadigitale.eu/feed/", "category": "Italia", "lang": "it", "max_items": 15, "ai_filter": True},
    {"name": "Il Sole 24 Ore Tech", "url": "https://www.ilsole24ore.com/rss/tecnologia.xml", "category": "Italia", "lang": "it", "max_items": 12, "ai_filter": True},
    {"name": "Punto Informatico", "url": "https://www.punto-informatico.it/feed/", "category": "Italia", "lang": "it", "max_items": 15, "ai_filter": True},
    {"name": "Hardware Upgrade", "url": "https://www.hwupgrade.it/rss/news.xml", "category": "Italia", "lang": "it", "max_items": 15, "ai_filter": True},
    {"name": "HDblog", "url": "https://www.hdblog.it/rss/", "category": "Italia", "lang": "it", "max_items": 15, "ai_filter": True},

    # Laboratori & Ricerca AI (Internazionali)
    {"name": "OpenAI News", "url": "https://openai.com/news/rss.xml", "category": "Laboratori", "lang": "en", "max_items": 10},
    {"name": "Google DeepMind", "url": "https://deepmind.google/blog/rss.xml", "category": "Laboratori", "lang": "en", "max_items": 10},
    {"name": "Google AI Blog", "url": "https://blog.google/technology/ai/rss/", "category": "Laboratori", "lang": "en", "max_items": 10},
    {"name": "Hugging Face", "url": "https://huggingface.co/blog/feed.xml", "category": "Laboratori", "lang": "en", "max_items": 10},

    # Media Tech (Internazionali)
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/", "category": "Media & Tech", "lang": "en", "max_items": 10},
    {"name": "The Verge AI", "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", "category": "Media & Tech", "lang": "en", "max_items": 10},
    {"name": "Ars Technica AI", "url": "https://arstechnica.com/ai/feed/", "category": "Media & Tech", "lang": "en", "max_items": 8},
    {"name": "MIT Tech Review", "url": "https://www.technologyreview.com/feed/", "category": "Media & Tech", "lang": "en", "max_items": 12, "ai_filter": True},

    # Ricerca Accademica
    {"name": "MIT News AI", "url": "https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml", "category": "Ricerca", "lang": "en", "max_items": 8},
    {"name": "BAIR Berkeley", "url": "https://bair.berkeley.edu/blog/feed.xml", "category": "Ricerca", "lang": "en", "max_items": 6},
    {"name": "arXiv cs.AI", "url": "https://rss.arxiv.org/rss/cs.AI", "category": "Ricerca", "lang": "en", "max_items": 8},
]

AI_KEYWORDS = re.compile(
    r"\b(ai|ia|i\.a\.|intelligenza artificiale|artificial intelligence|llm|chatgpt|gpt|gemini|"
    r"claude|openai|anthropic|deepmind|copilot|perplexity|grok|machine learning|"
    r"deep learning|reti neurali|neural|nvidia|agenti|agent|agents|robotics|robotica|"
    r"deepseek|mistral|llama)\b",
    re.IGNORECASE,
)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; AI-News-Hub-Bot/1.0)"}
GTX_URL = "https://translate.googleapis.com/translate_a/single"


def clean_html(raw_html: str, max_len: int = 260) -> str:
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_len:
        text = text[: max_len - 3].rsplit(" ", 1)[0] + "..."
    return text


def extract_image(entry) -> str:
    for key in ("media_content", "media_thumbnail"):
        media = entry.get(key)
        if isinstance(media, list) and media:
            url = media[0].get("url", "")
            if url.startswith("http"):
                return url
    for enc in entry.get("enclosures", []):
        if enc.get("type", "").startswith("image/") and enc.get("href", "").startswith("http"):
            return enc["href"]
    html_parts = []
    if entry.get("summary"):
        html_parts.append(entry["summary"])
    for c in entry.get("content", []):
        html_parts.append(c.get("value", ""))
    for part in html_parts:
        soup = BeautifulSoup(part, "html.parser")
        img = soup.find("img")
        if img and img.get("src", "").startswith("http"):
            return img["src"]
    return ""


def parse_date(entry) -> datetime:
    for field in ("published_parsed", "updated_parsed"):
        parsed = entry.get(field)
        if parsed:
            dt_utc = datetime.fromtimestamp(mktime(parsed), tz=timezone.utc)
            return dt_utc.astimezone(ROME_TZ)
    return datetime.now(ROME_TZ)


def make_id(url: str, title: str) -> str:
    base = (url or title).encode("utf-8")
    return hashlib.sha256(base).hexdigest()[:16]


def load_json(path: Path, default):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return default
    return default


def save_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def gtx_translate(text: str) -> str | None:
    if not text:
        return ""
    try:
        resp = requests.post(
            GTX_URL,
            params={"client": "gtx", "sl": "en", "tl": "it", "dt": "t"},
            data={"q": text},
            headers=HEADERS,
            timeout=12,
        )
        if resp.status_code != 200:
            print(f"  [!] HTTP {resp.status_code} da traduttore")
            return None
        data = resp.json()
        return "".join(seg[0] for seg in data[0] if seg and seg[0]).strip()
    except Exception as exc:
        print(f"  [!] Errore traduzione: {exc}")
        return None


def translate_articles_batch(articles: list[dict]) -> int:
    pending = [a for a in articles if not a.get("translated") and a.get("lang", "en") != "it"]
    if not pending:
        return 0

    translated_count = 0
    chunk_size = 8

    for start in range(0, len(pending), chunk_size):
        chunk = pending[start : start + chunk_size]
        lines = []
        for art in chunk:
            t = (art.get("title_en") or art.get("title") or "").replace("\n", " ").strip()
            s = (art.get("summary_en") or art.get("summary") or "").replace("\n", " ").strip()
            art["title_en"] = t
            art["summary_en"] = s
            lines.append(t or "-")
            lines.append(s or "-")

        joined = "\n".join(lines)
        res = gtx_translate(joined)
        time.sleep(0.25)

        if res:
            out_lines = [ln.strip() for ln in res.split("\n")]
            if len(out_lines) == len(lines):
                for idx, art in enumerate(chunk):
                    it_t = out_lines[idx * 2]
                    it_s = out_lines[idx * 2 + 1]
                    if art["title_en"]:
                        art["title"] = it_t
                    if art["summary_en"]:
                        art["summary"] = it_s
                    art["translated"] = True
                    translated_count += 1
                continue

        for art in chunk:
            it_t = gtx_translate(art["title_en"]) if art["title_en"] else ""
            it_s = gtx_translate(art["summary_en"]) if art["summary_en"] else ""
            time.sleep(0.15)
            if it_t is not None and (it_s is not None or not art["summary_en"]):
                art["title"] = it_t or art["title_en"]
                art["summary"] = it_s if art["summary_en"] else ""
                art["translated"] = True
                translated_count += 1

    return translated_count


def main():
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    now_rome = datetime.now(ROME_TZ)

    known_cache = {}
    for fpath in sorted(ARCHIVE_DIR.glob("*.json"), reverse=True)[:7]:
        day_data = load_json(fpath, {})
        for item in day_data.get("articles", []):
            if item.get("translated") or item.get("lang") == "it":
                known_cache[item["id"]] = item

    fetched_articles = []

    for feed_cfg in FEEDS:
        print(f"Scaricamento: {feed_cfg['name']}...")
        try:
            resp = requests.get(feed_cfg["url"], headers=HEADERS, timeout=20)
            resp.raise_for_status()
            parsed = feedparser.parse(resp.content)
        except Exception as exc:
            print(f"  [!] Errore su {feed_cfg['name']}: {exc}")
            continue

        count = 0
        lang = feed_cfg.get("lang", "en")

        for entry in parsed.entries:
            if count >= feed_cfg["max_items"]:
                break

            raw_title = clean_html(entry.get("title", ""), max_len=200)
            link = (entry.get("link") or "").strip()
            if not raw_title or not link:
                continue

            raw_summary = entry.get("summary") or ""
            if not raw_summary and entry.get("content"):
                raw_summary = entry["content"][0].get("value", "")
            summary_clean = clean_html(raw_summary, max_len=240)

            if feed_cfg.get("ai_filter"):
                haystack = f"{raw_title} {summary_clean}"
                if not AI_KEYWORDS.search(haystack):
                    continue

            pub_dt = parse_date(entry)
            if pub_dt > now_rome + timedelta(hours=2):
                pub_dt = now_rome

            art_id = make_id(link, raw_title)
            if art_id in known_cache:
                cached = known_cache[art_id]
                article = {
                    **cached,
                    "image": extract_image(entry) or cached.get("image", ""),
                    "published_at": pub_dt.isoformat(),
                    "date": pub_dt.strftime("%Y-%m-%d"),
                }
            elif lang == "it":
                article = {
                    "id": art_id,
                    "title": raw_title,
                    "title_en": raw_title,
                    "url": link,
                    "summary": summary_clean,
                    "summary_en": summary_clean,
                    "image": extract_image(entry),
                    "source": feed_cfg["name"],
                    "category": feed_cfg["category"],
                    "lang": "it",
                    "published_at": pub_dt.isoformat(),
                    "date": pub_dt.strftime("%Y-%m-%d"),
                    "translated": True,
                }
            else:
                article = {
                    "id": art_id,
                    "title": raw_title,
                    "title_en": raw_title,
                    "url": link,
                    "summary": summary_clean,
                    "summary_en": summary_clean,
                    "image": extract_image(entry),
                    "source": feed_cfg["name"],
                    "category": feed_cfg["category"],
                    "lang": "en",
                    "published_at": pub_dt.isoformat(),
                    "date": pub_dt.strftime("%Y-%m-%d"),
                    "translated": False,
                }

            fetched_articles.append(article)
            count += 1

    tr_new = translate_articles_batch(fetched_articles)
    print(f"Nuovi articoli tradotti in italiano: {tr_new}")

    by_date = {}
    for art in fetched_articles:
        by_date.setdefault(art["date"], []).append(art)

    for date_str, new_items in by_date.items():
        archive_file = ARCHIVE_DIR / f"{date_str}.json"
        existing = load_json(archive_file, {"date": date_str, "articles": []})
        merged_map = {item["id"]: item for item in existing.get("articles", [])}
        for item in new_items:
            merged_map[item["id"]] = item

        merged_list = sorted(merged_map.values(), key=lambda x: x["published_at"], reverse=True)
        save_json(
            archive_file,
            {
                "date": date_str,
                "updated_at": now_rome.isoformat(),
                "count": len(merged_list),
                "articles": merged_list,
            },
        )

    archive_files = sorted(ARCHIVE_DIR.glob("*.json"), reverse=True)
    dates_index = []
    all_recent = []

    for idx, fpath in enumerate(archive_files):
        day_data = load_json(fpath, {})
        d_str = day_data.get("date") or fpath.stem
        arts = day_data.get("articles", [])
        if not arts:
            continue

        if idx < 3:
            tr_old = translate_articles_batch(arts)
            if tr_old > 0:
                print(f"Tradotti {tr_old} articoli in archivio per {d_str}")
                day_data["articles"] = arts
                day_data["updated_at"] = now_rome.isoformat()
                save_json(fpath, day_data)
            all_recent.extend(arts)

        dates_index.append({"date": d_str, "count": len(arts)})

    unique_recent = {a["id"]: a for a in all_recent}
    latest_sorted = sorted(unique_recent.values(), key=lambda x: x["published_at"], reverse=True)[:90]

    save_json(
        DATA_DIR / "latest.json",
        {"updated_at": now_rome.isoformat(), "count": len(latest_sorted), "articles": latest_sorted},
    )
    save_json(
        DATA_DIR / "dates.json",
        {"updated_at": now_rome.isoformat(), "dates": dates_index},
    )
    print(f"Completato! Salvate {len(latest_sorted)} notizie recenti e {len(dates_index)} giorni in archivio.")


if __name__ == "__main__":
    main()
