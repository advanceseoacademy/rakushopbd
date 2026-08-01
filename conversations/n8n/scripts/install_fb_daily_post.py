#!/usr/bin/env python3
"""Install FB daily AI product post workflow + ensure sheet columns.

Runs on VPS host. Does not print secrets.
"""
from __future__ import annotations

import json
import re
import sqlite3
import subprocess
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SHEET_ID = "1qxqOHEen1Sg8Kr-62XdWkh40ff9jUpntQ5I56zPzpSg"
SHEET_GID = 366447561
SHEET_TAB = "products_list"
DOC = {
    "__rl": True,
    "value": SHEET_ID,
    "mode": "list",
    "cachedResultName": "Products",
    "cachedResultUrl": f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit?usp=drivesdk",
}
SHEET_REF = {
    "__rl": True,
    "value": SHEET_GID,
    "mode": "list",
    "cachedResultName": SHEET_TAB,
    "cachedResultUrl": f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit#gid={SHEET_GID}",
}
GS_CRED = {"googleSheetsOAuth2Api": {"id": "Si2RPAeccBsiW3hN", "name": "Google Sheets account 2"}}
PAGE_ID = "534183473116951"
WF_NAME = "FB daily AI product post"
WF_ID = "FbDailyAiPost01"
DB = "/opt/n8n/n8n_data/database.sqlite"
COMPOSE = "/opt/n8n/docker-compose.yml"
GOLDEN = "/opt/n8n/locked/fb-daily-ai-post.golden.json"


def http_json(method, url, data=None, headers=None, form=False):
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
        with urllib.request.urlopen(req, timeout=90) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {url} -> {e.code}: {e.read().decode()[:500]}") from e


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
    script = r"""
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
    Path("/tmp/dump_google_env.js").write_text(script)
    subprocess.check_call(
        [
            "docker",
            "cp",
            "/tmp/dump_google_env.js",
            "n8n:/tmp/dump_google_env.js",
        ]
    )
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
    subprocess.call(
        ["docker", "exec", "n8n", "rm", "-f", "/tmp/google_oauth.json", "/tmp/dump_google_env.js"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def google_access_token():
    oauth = json.loads(Path("/tmp/google_oauth.json").read_text())
    data = http_json(
        "POST",
        "https://oauth2.googleapis.com/token",
        {
            "client_id": oauth["client_id"],
            "client_secret": oauth["client_secret"],
            "refresh_token": oauth["refresh_token"],
            "grant_type": "refresh_token",
        },
        form=True,
    )
    return data["access_token"]


def ensure_sheet_columns(access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    meta = http_json(
        "GET",
        f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}?fields=sheets.properties",
        headers=headers,
    )
    # read header row
    values = http_json(
        "GET",
        f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/{urllib.parse.quote(SHEET_TAB + '!1:1')}",
        headers=headers,
    )
    row = (values.get("values") or [[]])[0]
    print("sheet_header_before", row)
    needed = ["FB_Posted", "FB_Posted_At", "FB_Post_Id"]
    changed = False
    for col in needed:
        if col not in row:
            row.append(col)
            changed = True
    if changed:
        http_json(
            "PUT",
            f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/{urllib.parse.quote(SHEET_TAB + '!1:1')}?valueInputOption=RAW",
            {"values": [row]},
            headers=headers,
        )
        print("sheet_header_updated", row)
    else:
        print("sheet_header_ok", row)
    return row


def nid():
    return str(uuid.uuid4())


def build_nodes():
    schedule_id = nid()
    manual_id = nid()
    read_id = nid()
    pick_id = nid()
    caption_id = nid()
    parse_cap_id = nid()
    image_id = nid()
    parse_img_id = nid()
    post_id = nid()
    mark_id = nid()

    pick_code = r"""
const staticData = $getWorkflowStaticData('global');
const rows = items
  .map(i => i.json)
  .filter(r => String(r['Product Name'] || '').trim());
if (!rows.length) {
  return [];
}

// Prefer never-posted rows first; otherwise rotate by index (full catalog loop).
const posted = (v) => String(v || '').trim().toUpperCase() === 'YES';
const unposted = rows.filter(r => !posted(r.FB_Posted));
let next;
if (unposted.length) {
  next = unposted[0];
} else {
  const idx = Number(staticData.nextIndex || 0) % rows.length;
  next = rows[idx];
  staticData.nextIndex = (idx + 1) % rows.length;
}

const slug = String(next['Product Slug'] || next.Slug || '').trim();
const name = String(next['Product Name'] || '').trim();
const price = String(next.Price || '').trim();
const discount = String(next['Discount %'] || '').trim();
const link = slug ? `https://www.rakushopbd.com/product/${slug}` : 'https://www.rakushopbd.com/';
return [{
  json: {
    productName: name,
    slug,
    price,
    discount,
    productUrl: link,
  }
}];
""".strip()

    parse_cap_code = r"""
const prev = $('Pick Next Product').first().json;
const body = items[0].json;
const caption = (((body.choices || [])[0] || {}).message || {}).content || '';
if (!String(caption).trim()) {
  throw new Error('Empty caption from OpenAI');
}
return [{ json: { ...prev, caption: String(caption).trim() } }];
""".strip()

    parse_img_code = r"""
const prev = $('Parse Caption').first().json;
const body = items[0].json;
const b64 = (((body.data || [])[0] || {}).b64_json) || '';
if (!String(b64).trim()) {
  throw new Error('No image data from OpenAI');
}
const binaryData = await this.helpers.prepareBinaryData(
  Buffer.from(b64, 'base64'),
  'fb-post.png',
  'image/png'
);
return [{
  json: { ...prev },
  binary: { data: binaryData },
}];
""".strip()

    nodes = [
        {
            "parameters": {
                "rule": {
                    "interval": [
                        {
                            "field": "days",
                            "triggerAtHour": 9,
                            "triggerAtMinute": 0,
                        },
                        {
                            "field": "days",
                            "triggerAtHour": 20,
                            "triggerAtMinute": 0,
                        },
                    ]
                }
            },
            "id": schedule_id,
            "name": "Twice Daily 9am & 8pm BD",
            "type": "n8n-nodes-base.scheduleTrigger",
            "typeVersion": 1.2,
            "position": [0, -120],
        },
        {
            "parameters": {},
            "id": manual_id,
            "name": "Manual Test",
            "type": "n8n-nodes-base.manualTrigger",
            "typeVersion": 1,
            "position": [0, 120],
        },
        {
            "parameters": {
                "resource": "sheet",
                "operation": "read",
                "documentId": DOC,
                "sheetName": SHEET_REF,
                "options": {},
            },
            "id": read_id,
            "name": "Read Products",
            "type": "n8n-nodes-base.googleSheets",
            "typeVersion": 4.5,
            "position": [260, 0],
            "credentials": GS_CRED,
        },
        {
            "parameters": {"jsCode": pick_code},
            "id": pick_id,
            "name": "Pick Next Product",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [520, 0],
        },
        {
            "parameters": {
                "method": "POST",
                "url": "https://api.openai.com/v1/chat/completions",
                "sendHeaders": True,
                "headerParameters": {
                    "parameters": [
                        {
                            "name": "Authorization",
                            "value": "=Bearer {{ $env.OPENAI_API_KEY }}",
                        }
                    ]
                },
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": (
                    "={{ JSON.stringify({ model: 'gpt-4.1-mini', temperature: 0.8, "
                    "messages: ["
                    "{ role: 'system', content: 'You write Facebook Page captions for RakuShopBD, a Japanese skincare shop in Bangladesh. Write primarily in Bangla. Keep product names in English. Include price in BDT if given, the product URL, and a soft CTA (Messenger/website order). 4-7 short lines. No hashtag spam (max 3). Do not invent medical claims.' },"
                    "{ role: 'user', content: `Product: ${$json.productName}\\nPrice: ৳${$json.price}\\nDiscount%: ${$json.discount}\\nURL: ${$json.productUrl}\\nWrite today\\'s post caption.` }"
                    "] }) }}"
                ),
                "options": {},
            },
            "id": caption_id,
            "name": "Generate Caption",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [780, 0],
        },
        {
            "parameters": {"jsCode": parse_cap_code},
            "id": parse_cap_id,
            "name": "Parse Caption",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1040, 0],
        },
        {
            "parameters": {
                "method": "POST",
                "url": "https://api.openai.com/v1/images/generations",
                "sendHeaders": True,
                "headerParameters": {
                    "parameters": [
                        {
                            "name": "Authorization",
                            "value": "=Bearer {{ $env.OPENAI_API_KEY }}",
                        }
                    ]
                },
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": (
                    "={{ JSON.stringify({ model: 'gpt-image-1', size: '1024x1024', n: 1, "
                    "prompt: `Create a polished Facebook promotional creative for Japanese skincare brand mood. Product theme: ${$json.productName}. Elegant soft lighting, clean beauty aesthetic, lifestyle flat-lay or abstract spa atmosphere. Include subtle space for text. Do NOT copy real trademark packaging logos or exact bottle labels. No readable brand logos. RakuShopBD Bangladesh shop vibe.` }) }}"
                ),
                "options": {},
            },
            "id": image_id,
            "name": "Generate Image",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [1300, 0],
        },
        {
            "parameters": {"jsCode": parse_img_code},
            "id": parse_img_id,
            "name": "Parse Image",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1560, 0],
        },
        {
            "parameters": {
                "method": "POST",
                "url": f"https://graph.facebook.com/v21.0/{PAGE_ID}/photos",
                "sendBody": True,
                "contentType": "multipart-form-data",
                "bodyParameters": {
                    "parameters": [
                        {
                            "name": "source",
                            "parameterType": "formBinaryData",
                            "inputDataFieldName": "data",
                        },
                        {"name": "caption", "value": "={{ $json.caption }}"},
                        {"name": "published", "value": "true"},
                        {
                            "name": "access_token",
                            "value": "={{ $env.FB_PAGE_ACCESS_TOKEN }}",
                        },
                    ]
                },
                "options": {},
            },
            "id": post_id,
            "name": "Post to Facebook",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [1820, 0],
        },
        {
            "parameters": {
                "resource": "sheet",
                "operation": "update",
                "documentId": DOC,
                "sheetName": SHEET_REF,
                "columns": {
                    "mappingMode": "defineBelow",
                    "value": {
                        "Product Slug": "={{ $('Parse Image').item.json.slug }}",
                        "FB_Posted": "YES",
                        "FB_Posted_At": "={{ $now.setZone('Asia/Dhaka').toFormat('yyyy-LL-dd HH:mm') }}",
                        "FB_Post_Id": "={{ $json.id || $json.post_id || '' }}",
                    },
                    "matchingColumns": ["Product Slug"],
                    "schema": [
                        {"id": "Product Slug", "displayName": "Product Slug", "required": False, "defaultMatch": True, "display": True, "type": "string", "canBeUsedToMatch": True},
                        {"id": "FB_Posted", "displayName": "FB_Posted", "required": False, "defaultMatch": False, "display": True, "type": "string", "canBeUsedToMatch": False},
                        {"id": "FB_Posted_At", "displayName": "FB_Posted_At", "required": False, "defaultMatch": False, "display": True, "type": "string", "canBeUsedToMatch": False},
                        {"id": "FB_Post_Id", "displayName": "FB_Post_Id", "required": False, "defaultMatch": False, "display": True, "type": "string", "canBeUsedToMatch": False},
                    ],
                    "attemptToConvertTypes": False,
                    "convertFieldsToString": False,
                },
                "options": {},
            },
            "id": mark_id,
            "name": "Mark Posted",
            "type": "n8n-nodes-base.googleSheets",
            "typeVersion": 4.5,
            "position": [2080, 0],
            "credentials": GS_CRED,
        },
    ]

    connections = {
        "Twice Daily 9am & 8pm BD": {
            "main": [[{"node": "Read Products", "type": "main", "index": 0}]]
        },
        "Manual Test": {
            "main": [[{"node": "Read Products", "type": "main", "index": 0}]]
        },
        "Read Products": {
            "main": [[{"node": "Pick Next Product", "type": "main", "index": 0}]]
        },
        "Pick Next Product": {
            "main": [[{"node": "Generate Caption", "type": "main", "index": 0}]]
        },
        "Generate Caption": {
            "main": [[{"node": "Parse Caption", "type": "main", "index": 0}]]
        },
        "Parse Caption": {
            "main": [[{"node": "Generate Image", "type": "main", "index": 0}]]
        },
        "Generate Image": {
            "main": [[{"node": "Parse Image", "type": "main", "index": 0}]]
        },
        "Parse Image": {
            "main": [[{"node": "Post to Facebook", "type": "main", "index": 0}]]
        },
        "Post to Facebook": {
            "main": [[{"node": "Mark Posted", "type": "main", "index": 0}]]
        },
    }
    return nodes, connections


def upsert_workflow(nodes, connections):
    conn = sqlite3.connect(DB)
    now = time.strftime("%Y-%m-%d %H:%M:%S.000")
    version_id = str(uuid.uuid4())
    nodes_s = json.dumps(nodes)
    conn_s = json.dumps(connections)
    settings = json.dumps({"executionOrder": "v1", "timezone": "Asia/Dhaka"})
    meta = json.dumps({"templateCredsSetupCompleted": True})

    existing = conn.execute("SELECT id FROM workflow_entity WHERE id=?", (WF_ID,)).fetchone()
    if existing:
        conn.execute(
            "UPDATE workflow_entity SET name=?, active=1, nodes=?, connections=?, settings=?, meta=?, updatedAt=?, versionId=?, activeVersionId=?, triggerCount=1, nodeGroups=?, pinData=?, isArchived=0 WHERE id=?",
            (WF_NAME, nodes_s, conn_s, settings, meta, now, version_id, version_id, "[]", "{}", WF_ID),
        )
    else:
        conn.execute(
            "INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, staticData, pinData, versionId, triggerCount, meta, parentFolderId, createdAt, updatedAt, isArchived, versionCounter, description, activeVersionId, nodeGroups, sourceWorkflowId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                WF_ID,
                WF_NAME,
                1,
                nodes_s,
                conn_s,
                settings,
                "{}",
                "{}",
                version_id,
                1,
                meta,
                None,
                now,
                now,
                0,
                1,
                "Twice daily 09:00 & 20:00 Asia/Dhaka AI product posts",
                version_id,
                "[]",
                None,
            ),
        )

    conn.execute(
        "INSERT INTO workflow_history (versionId, workflowId, authors, createdAt, updatedAt, nodes, connections, name, autosaved, description, nodeGroups) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (
            version_id,
            WF_ID,
            "install_fb_daily_post",
            now,
            now,
            nodes_s,
            conn_s,
            WF_NAME,
            0,
            "Daily AI product post",
            "[]",
        ),
    )

    # n8n 2.x UI only lists workflows linked via shared_workflow
    PROJECT_ID = "Te1MVzpY1VpLdrJJ"
    shared = conn.execute(
        "SELECT 1 FROM shared_workflow WHERE workflowId=?", (WF_ID,)
    ).fetchone()
    if not shared:
        conn.execute(
            "INSERT INTO shared_workflow (workflowId, projectId, role, createdAt, updatedAt) VALUES (?,?,?,?,?)",
            (WF_ID, PROJECT_ID, "workflow:owner", now, now),
        )
        print("shared_workflow_linked", PROJECT_ID)
    else:
        print("shared_workflow_exists")

    conn.commit()
    conn.close()
    Path(GOLDEN).write_text(json.dumps({"id": WF_ID, "name": WF_NAME, "nodes": nodes, "connections": connections}, indent=2))
    print("workflow_upserted", WF_ID, version_id)


def main():
    dump_google_oauth()
    token = google_access_token()
    ensure_sheet_columns(token)
    Path("/tmp/google_oauth.json").unlink(missing_ok=True)
    Path("/tmp/dump_google_env.js").unlink(missing_ok=True)

    nodes, connections = build_nodes()
    upsert_workflow(nodes, connections)

    # restart n8n so active schedule is loaded
    subprocess.check_call(["docker", "compose", "-f", "/opt/n8n/docker-compose.yml", "up", "-d"], cwd="/opt/n8n")
    time.sleep(8)
    # verify workflow present
    conn = sqlite3.connect(DB)
    row = conn.execute(
        "SELECT id, name, active, activeVersionId FROM workflow_entity WHERE id=?", (WF_ID,)
    ).fetchone()
    print("verify", row)
    conn.close()


if __name__ == "__main__":
    main()
