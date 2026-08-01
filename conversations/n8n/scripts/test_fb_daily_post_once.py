#!/usr/bin/env python3
"""One-shot test for FB daily AI product post pipeline (host)."""
from __future__ import annotations

import json
import re
import sqlite3
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

SHEET_ID = "1qxqOHEen1Sg8Kr-62XdWkh40ff9jUpntQ5I56zPzpSg"
SHEET_TAB = "products_list"
PAGE_ID = "534183473116951"
DB = "/opt/n8n/n8n_data/database.sqlite"
COMPOSE = "/opt/n8n/docker-compose.yml"


def http_json(method, url, data=None, headers=None, form=False, timeout=120):
    body = None
    hdrs = dict(headers or {})
    if data is not None:
        if form:
            body = urllib.parse.urlencode(data).encode()
            hdrs["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            body = json.dumps(data).encode()
            hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {url} -> {e.code}: {e.read().decode()[:800]}") from e


def compose_env(key: str) -> str:
    m = re.search(rf"{re.escape(key)}:\s*(\S+)", Path(COMPOSE).read_text())
    if not m:
        raise RuntimeError(f"missing {key}")
    return m.group(1).strip().strip('"').strip("'")


def dump_google_oauth():
    enc_key = re.search(r"N8N_ENCRYPTION_KEY:\s*(\S+)", Path(COMPOSE).read_text()).group(1)
    conn = sqlite3.connect(DB)
    cred = conn.execute(
        "SELECT data FROM credentials_entity WHERE id=?", ("Si2RPAeccBsiW3hN",)
    ).fetchone()[0]
    conn.close()
    cjs = subprocess.check_output(
        [
            "docker",
            "exec",
            "n8n",
            "sh",
            "-c",
            'find /usr/local/lib/node_modules/n8n -path "*crypto-js/index.js" | head -1',
        ],
        text=True,
    ).strip()
    Path("/tmp/dump_google_env.js").write_text(
        r"""
const CryptoJS = require(process.env.CJS);
const fs = require('fs');
const j = JSON.parse(CryptoJS.AES.decrypt(process.env.CRED, process.env.ENC_KEY).toString(CryptoJS.enc.Utf8));
const o = j.oauthTokenData || {};
fs.writeFileSync('/tmp/google_oauth.json', JSON.stringify({
  client_id: j.clientId,
  client_secret: j.clientSecret,
  refresh_token: o.refresh_token,
}));
console.log('oauth_ok');
"""
    )
    subprocess.check_call(["docker", "cp", "/tmp/dump_google_env.js", "n8n:/tmp/dump_google_env.js"])
    subprocess.check_call(
        [
            "docker",
            "exec",
            "-e",
            f"ENC_KEY={enc_key}",
            "-e",
            f"CRED={cred}",
            "-e",
            f"CJS={cjs}",
            "n8n",
            "node",
            "/tmp/dump_google_env.js",
        ]
    )
    subprocess.check_call(["docker", "cp", "n8n:/tmp/google_oauth.json", "/tmp/google_oauth.json"])


def google_token():
    oauth = json.loads(Path("/tmp/google_oauth.json").read_text())
    return http_json(
        "POST",
        "https://oauth2.googleapis.com/token",
        {
            "client_id": oauth["client_id"],
            "client_secret": oauth["client_secret"],
            "refresh_token": oauth["refresh_token"],
            "grant_type": "refresh_token",
        },
        form=True,
    )["access_token"]


def main():
    dump_google_oauth()
    gtoken = google_token()
    openai_key = compose_env("OPENAI_API_KEY")
    fb_token = compose_env("FB_PAGE_ACCESS_TOKEN")

    headers = {"Authorization": f"Bearer {gtoken}"}
    values = http_json(
        "GET",
        f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/{urllib.parse.quote(SHEET_TAB)}",
        headers=headers,
    )["values"]
    header = values[0]
    rows = [dict(zip(header, r + [""] * (len(header) - len(r)))) for r in values[1:]]
    rows = [r for r in rows if str(r.get("Product Name", "")).strip()]

    def is_posted(r):
        return str(r.get("FB_Posted", "")).strip().upper() == "YES"

    next_row = next((r for r in rows if not is_posted(r)), None)
    if not next_row:
        next_row = rows[0]
    name = next_row["Product Name"].strip()
    slug = str(next_row.get("Product Slug", "")).strip()
    price = str(next_row.get("Price", "")).strip()
    discount = str(next_row.get("Discount %", "")).strip()
    url = f"https://www.rakushopbd.com/product/{slug}" if slug else "https://www.rakushopbd.com/"
    print("picked", name, slug, price)

    cap = http_json(
        "POST",
        "https://api.openai.com/v1/chat/completions",
        {
            "model": "gpt-4.1-mini",
            "temperature": 0.8,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You write Facebook Page captions for RakuShopBD, a Japanese skincare shop in Bangladesh. "
                        "Write primarily in Bangla. Keep product names in English. Include price in BDT if given, "
                        "the product URL, and a soft CTA. 4-7 short lines. Max 3 hashtags. No invented medical claims."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Product: {name}\nPrice: ৳{price}\nDiscount%: {discount}\nURL: {url}\nWrite today's post caption.",
                },
            ],
        },
        headers={"Authorization": f"Bearer {openai_key}"},
    )
    caption = cap["choices"][0]["message"]["content"].strip()
    print("caption_chars", len(caption))
    print("caption_preview", caption[:180].replace("\n", " | "))

    img = http_json(
        "POST",
        "https://api.openai.com/v1/images/generations",
        {
            "model": "dall-e-3",
            "size": "1024x1024",
            "quality": "standard",
            "prompt": (
                f"Create a polished Facebook promotional creative for Japanese skincare brand mood. "
                f"Product theme: {name}. Elegant soft lighting, clean beauty aesthetic, lifestyle flat-lay "
                f"or abstract spa atmosphere. Include subtle space for text. Do NOT copy real trademark "
                f"packaging logos or exact bottle labels. No readable brand logos. RakuShopBD Bangladesh shop vibe."
            ),
        },
        headers={"Authorization": f"Bearer {openai_key}"},
        timeout=180,
    )
    image_url = img["data"][0]["url"]
    print("image_ok", bool(image_url))

    post = http_json(
        "POST",
        f"https://graph.facebook.com/v21.0/{PAGE_ID}/photos",
        {
            "url": image_url,
            "caption": caption,
            "published": "true",
            "access_token": fb_token,
        },
        form=True,
        timeout=120,
    )
    post_id = post.get("id") or post.get("post_id") or ""
    print("fb_post_id", post_id)

    # mark sheet row by Product Slug
    slug_col = header.index("Product Slug") + 1
    posted_col = header.index("FB_Posted") + 1
    at_col = header.index("FB_Posted_At") + 1
    id_col = header.index("FB_Post_Id") + 1
    row_num = None
    for i, r in enumerate(values[1:], start=2):
        cell = r[slug_col - 1] if len(r) >= slug_col else ""
        if cell == slug:
            row_num = i
            break
    if row_num is None:
        raise RuntimeError("slug row not found")
    now = datetime.now(ZoneInfo("Asia/Dhaka")).strftime("%Y-%m-%d %H:%M")

    def col_letter(n):
        s = ""
        while n:
            n, rem = divmod(n - 1, 26)
            s = chr(65 + rem) + s
        return s

    updates = [
        {"range": f"{SHEET_TAB}!{col_letter(posted_col)}{row_num}", "values": [["YES"]]},
        {"range": f"{SHEET_TAB}!{col_letter(at_col)}{row_num}", "values": [[now]]},
        {"range": f"{SHEET_TAB}!{col_letter(id_col)}{row_num}", "values": [[str(post_id)]]},
    ]
    http_json(
        "POST",
        f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values:batchUpdate",
        {"valueInputOption": "RAW", "data": updates},
        headers=headers,
    )
    print("sheet_marked", slug, "row", row_num)

    Path("/tmp/google_oauth.json").unlink(missing_ok=True)
    Path("/tmp/dump_google_env.js").unlink(missing_ok=True)
    print("TEST_OK")


if __name__ == "__main__":
    main()
