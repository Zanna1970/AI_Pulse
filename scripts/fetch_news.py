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
from deep_translator import GoogleTranslator

ROME_TZ = ZoneInfo("Europe/Rome")
DATA_DIR = Path("data")
ARCHIVE_DIR = DATA_DIR / "archive"

FEEDS = [
    {"name": "OpenAI News", "url": "https://openai.com/news/rss.xml", "category": "Laboratori", "max_items": 10},
    {"name": "Google DeepMind", "url": "https://deepmind.google/blog/rss.xml", "category": "Laboratori", "max_items": 10},
    {"name": "Google AI Blog", "url": "https://blog.google/technology/ai/rss/", "category": "Laboratori", "max_items": 10},
    {"name": "Hugging Face", "url": "https://huggingface.co/blog/feed.xml", "category": "Laboratori", "max_items": 10},
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/", "category": "Media & Tech", "max_items": 12},
    {"name": "The Verge AI", "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", "category": "Media & Tech", "max_items": 12},
    {"name": "Ars Technica AI", "url": "https://arstechnica.com/ai/feed/", "category": "Media & Tech", "max_items": 10},
    {"name": "MIT Tech Review", "url": "https://www.technologyreview.com/feed/", "category": "Media & Tech", "max_items": 15, "ai_filter": True},
    {"name": "MIT News AI", "url": "https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml", "category": "Ricerca", "max_items": 8},
    {"name": "BAIR Berkeley", "url": "https://bair.berkeley.edu/blog/feed.xml", "category": "Ricerca", "max_items": 6},
    {"name": "arXiv cs.AI", "url": "https://rss.arxiv.org/rss/cs.AI", "category": "Ricerca", "max_items": 8},
]

AI_KEYWORDS = re.compile(
    r"\b(ai|artificial intelligence|llm|gpt|gemini|claude|openai|anthropic|deepmind|"
    r"machine learning|deep learning|neural|nvidia|agent|agents|robotics|deepseek|mistral|llama)\b",
    re.IGNORECASE,
)

HEADERS = {"User-Agent": "AI-News-Hub-Bot/1.0 (+https://github.com/)"}


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


def translate_text(translator: GoogleTranslator, text: str) -> tuple[str, bool]:
    if not text:
        return "", True
    try:
        res = translator.translate(text)
        time.sleep(0.1)
        if res and res.strip():
            return res.strip(), True
    except Exception as exc:
        print(f"  [!] Errore traduzione: {exc}")
    return text, False


def ensure_translated(translator: GoogleTranslator, art: dict) -> dict:
    if art.get("translated") and art.get("title_en"):
        return art

    orig_title = art.get("title_en") or art.get("title", "")
    orig_summary = art.get("summary_en") or art.get("summary", "")

    it_title, ok_t = translate_text(translator, orig_title)
    it_summary, ok_s = translate_text(translator, orig_summary)

    art["title_en"] = orig_title
    art["summary_en"] = orig_summary
    art["title"] = it_title
    art["summary"] = it_summary
    art["translated"] = bool(ok_t and ok_s)
    return art


def main():
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    now_rome = datetime.now(ROME_TZ)
    translator = GoogleTranslator(source="auto", target="it")

    # Cache articoli gia tradotti nei giorni recenti
    known_cache = {}
    for fpath in sorted(ARCHIVE_DIR.glob("*.json"), reverse=True)[:7]:
        day_data = load_json(fpath, {})
        for item in day_data.get("articles", []):
            if item.get("translated") and item.get("title_en"):
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
        for entry in parsed.entries:
            if count >= feed_cfg["max_items"]:
                break

            title_en = clean_html(entry.get("title", ""), max_len=200)
            link = (entry.get("link") or "").strip()
            if not title_en or not link:
                continue

            raw_summary = entry.get("summary") or ""
            if not raw_summary and entry.get("content"):
                raw_summary = entry["content"][0].get("value", "")
            summary_en = clean_html(raw_summary, max_len=240)

            if feed_cfg.get("ai_filter"):
                haystack = f"{title_en} {summary_en}"
                if not AI_KEYWORDS.search(haystack):
                    continue

            pub_dt = parse_date(entry)
            if pub_dt > now_rome + timedelta(hours=2):
                pub_dt = now_rome

            art_id = make_id(link, title_en)
            if art_id in known_cache:
                cached = known_cache[art_id]
                article = {
                    **cached,
                    "image": extract_image(entry) or cached.get("image", ""),
                    "published_at": pub_dt.isoformat(),
                    "date": pub_dt.strftime("%Y-%m-%d"),
                }
            else:
                article = {
                    "id": art_id,
                    "title": title_en,
                    "title_en": title_en,
                    "url": link,
                    "summary": summary_en,
                    "summary_en": summary_en,
                    "image": extract_image(entry),
                    "source": feed_cfg["name"],
                    "category": feed_cfg["category"],
                    "published_at": pub_dt.isoformat(),
                    "date": pub_dt.strftime("%Y-%m-%d"),
                    "translated": False,
                }
                article = ensure_translated(translator, article)

            fetched_articles.append(article)
            count += 1

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

    # Traduci eventuali articoli degli ultimi 3 giorni salvati in precedenza solo in inglese
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
            changed = False
            for i, art in enumerate(arts):
                if not art.get("translated"):
                    arts[i] = ensure_translated(translator, art)
                    changed = True
            if changed:
                day_data["articles"] = arts
                day_data["updated_at"] = now_rome.isoformat()
                save_json(fpath, day_data)
            all_recent.extend(arts)

        dates_index.append({"date": d_str, "count": len(arts)})

    unique_recent = {a["id"]: a for a in all_recent}
    latest_sorted = sorted(unique_recent.values(), key=lambda x: x["published_at"], reverse=True)[:80]

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
