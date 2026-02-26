#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/content/external"
TMP_DIR="${TMPDIR:-/tmp}/ksl-instagram-sync"
mkdir -p "$OUT_DIR" "$TMP_DIR"

load_dotenv() {
  # Make local sync convenient: respect values in .env.local/.env (e.g. INSTAGRAM_FETCH_LIMIT).
  # This script is also used in CI/local dev; if these files don't exist, it's fine.
  for envfile in "$ROOT/.env.local" "$ROOT/.env"; do
    if [[ -f "$envfile" ]]; then
      set -a
      # shellcheck disable=SC1090
      source "$envfile"
      set +a
    fi
  done
}

load_dotenv

UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
APP_ID='936619743392459'
ASBD_ID='129477'
FEED_HOST="i.instagram.com"
FEED_IP="157.240.209.63"
HOME_HOST="www.instagram.com"
HOME_IP="157.240.209.174"

BUSINESS_USERNAME="${IG_BUSINESS_USERNAME:-kudoshu_vcook}"
PHOTO_USERNAME="${IG_PHOTO_USERNAME:-onoshu_photo}"
LIMIT="${INSTAGRAM_FETCH_LIMIT:-12}"
SYNC_ONLY="${INSTAGRAM_SYNC_ONLY:-${SYNC_ONLY:-both}}" # both|business|photo (SYNC_ONLY alias supported)

normalize_username() {
  echo "$1" | sed -E 's/^@//' | tr -d '[:space:]'
}

COOKIE_JAR="$TMP_DIR/cookies.txt"
CSRF_TOKEN_FILE="$TMP_DIR/csrftoken.txt"

ensure_anonymous_cookies() {
  # Refresh per run to avoid stale/blocked cookies.
  rm -f "$COOKIE_JAR" "$CSRF_TOKEN_FILE"

  curl -sS -L --connect-timeout 10 --max-time 60 \
    --resolve "${HOME_HOST}:443:${HOME_IP}" \
    -A "$UA" \
    -c "$COOKIE_JAR" \
    "https://${HOME_HOST}/" >/dev/null

  local csrf=""
  csrf="$(awk '$6=="csrftoken"{print $7}' "$COOKIE_JAR" | tail -n 1)"
  if [[ -n "$csrf" ]]; then
    printf '%s' "$csrf" >"$CSRF_TOKEN_FILE"
  fi
}

get_csrf_token() {
  if [[ -f "$CSRF_TOKEN_FILE" ]]; then
    cat "$CSRF_TOKEN_FILE"
  fi
}

fetch_profile_json() {
  local username="$1"
  local outfile="$2"
  local ok=0

  # NOTE: macOS resolver in this environment can be flaky for instagram.com.
  # Use pinned IPs to bypass DNS. If these ever change, update the values below.
  for host in "i.instagram.com" "www.instagram.com"; do
    local ip=""
    if [[ "$host" == "i.instagram.com" ]]; then
      ip="157.240.209.63"
    elif [[ "$host" == "www.instagram.com" ]]; then
      ip="157.240.209.174"
    fi

    if [[ -n "$ip" ]]; then
      if curl -sS -L \
        --resolve "${host}:443:${ip}" \
        -A "$UA" \
        -H "x-ig-app-id: $APP_ID" \
        -H "x-asbd-id: $ASBD_ID" \
        -H "Accept: application/json" \
        -H "Accept-Language: ja,en-US;q=0.9,en;q=0.8" \
        -H "Referer: https://www.instagram.com/" \
        "https://${host}/api/v1/users/web_profile_info/?username=${username}" \
        >"$outfile"; then
        if head -c 1 "$outfile" | grep -q '{'; then
          ok=1
          break
        fi
      fi
    fi
  done

  if [[ "$ok" -ne 1 ]]; then
    echo "[sync-instagram] ERROR: failed to fetch JSON for @$username" >&2
    return 1
  fi
}

extract_user_id() {
  local profile_json="$1"
  node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(j?.data?.user?.id||""))' "$profile_json"
}

fetch_feed_page() {
  local user_id="$1"
  local max_id="${2:-}"
  local outfile="$3"

  if [[ ! -f "$COOKIE_JAR" || ! -f "$CSRF_TOKEN_FILE" ]]; then
    ensure_anonymous_cookies
  fi
  local csrf=""
  csrf="$(get_csrf_token)"

  local url="https://${FEED_HOST}/api/v1/feed/user/${user_id}/?count=50"
  if [[ -n "$max_id" ]]; then
    url="${url}&max_id=${max_id}"
  fi

  curl -sS -L --connect-timeout 10 --max-time 60 \
    --resolve "${FEED_HOST}:443:${FEED_IP}" \
    -A "$UA" \
    -b "$COOKIE_JAR" \
    -H "x-ig-app-id: $APP_ID" \
    -H "x-asbd-id: $ASBD_ID" \
    -H "x-csrftoken: $csrf" \
    -H "Accept: application/json" \
    -H "Accept-Language: ja,en-US;q=0.9,en;q=0.8" \
    -H "Referer: https://www.instagram.com/" \
    "$url" >"$outfile"
}

extract_feed_next_max_id() {
  local feed_json="$1"
  node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const next=(j?.more_available && typeof j?.next_max_id==="string")?j.next_max_id:"";process.stdout.write(next);' "$feed_json"
}

extract_feed_items_count() {
  local feed_json="$1"
  node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(Array.isArray(j?.items)?j.items.length:0));' "$feed_json"
}

extract_feed_status() {
  local feed_json="$1"
  node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(j?.status||""));' "$feed_json"
}

extract_feed_require_login() {
  local feed_json="$1"
  node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(Boolean(j?.require_login)));' "$feed_json"
}

extract_feed_message() {
  local feed_json="$1"
  node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(j?.message||""));' "$feed_json"
}

append_feed_seeds_ndjson() {
  local username="$1"
  local feed_json="$2"
  local out_ndjson="$3"

  node - <<'NODE' "$username" "$feed_json" >>"$out_ndjson"
const fs = require("fs")

const [username, feedFile] = process.argv.slice(2)
const raw = fs.readFileSync(feedFile, "utf8")
const data = JSON.parse(raw)
const items = Array.isArray(data?.items) ? data.items : []

function normalizeSentence(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim()
}

function pickThumbnail(item) {
  const direct = item?.image_versions2?.candidates
  if (Array.isArray(direct) && direct[0]?.url) return String(direct[0].url)

  const carousel = item?.carousel_media
  if (Array.isArray(carousel) && carousel.length > 0) {
    const cand = carousel[0]?.image_versions2?.candidates
    if (Array.isArray(cand) && cand[0]?.url) return String(cand[0].url)
  }

  const thumbs = item?.thumbnail_versions
  if (Array.isArray(thumbs) && thumbs[0]?.url) return String(thumbs[0].url)

  return ""
}

for (const item of items) {
  const code = item?.code
  const takenAt = item?.taken_at
  if (!code || !takenAt) continue

  const productType = String(item?.product_type ?? "").toLowerCase()
  const urlKind = productType === "clips" ? "reel" : "p"
  const caption = item?.caption?.text?.trim?.() ?? ""
  const title = (caption.split(/\r?\n/)[0] || "").trim() || `Instagram post ${code}`
  const summary = normalizeSentence(caption)
  const url = `https://www.instagram.com/${urlKind}/${code}/`
  const date = new Date(takenAt * 1000).toISOString()
  const thumbnail = pickThumbnail(item)

  const seed = {
    id: `ig:${username}:${code}`,
    title,
    date,
    url,
    summary: summary || undefined,
    thumbnail: thumbnail || undefined,
  }

  process.stdout.write(JSON.stringify(seed) + "\n")
}
NODE
}

finalize_seeds_from_ndjson() {
  local ndjson="$1"
  local out="$2"

  node - <<'NODE' "$ndjson" "$out" "$LIMIT"
const fs = require("fs")

const [ndjson, out, limitRaw] = process.argv.slice(2)
const limit = Math.min(Math.max(parseInt(limitRaw || "12", 10) || 12, 1), 100)

const lines = fs.readFileSync(ndjson, "utf8").split(/\n/).filter(Boolean)
const items = []
for (const line of lines) {
  try {
    items.push(JSON.parse(line))
  } catch {}
}

const seen = new Set()
const deduped = []
for (const item of items) {
  // Prefer URL over id so username changes do not break dedupe.
  const key = item?.url || item?.id
  if (!key || seen.has(key)) continue
  seen.add(key)
  deduped.push(item)
}

deduped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
const sliced = deduped.slice(0, limit)

// If Instagram blocks feed access, we fall back to web_profile_info (~12 items).
// Avoid overwriting an already-large seed file with a tiny fallback, but still merge updates.
let existingCount = 0
let existing = []
try {
  if (fs.existsSync(out)) {
    const prev = JSON.parse(fs.readFileSync(out, "utf8"))
    if (Array.isArray(prev)) {
      existing = prev
      existingCount = prev.length
    }
  }
} catch {}

if (existingCount > 12 && sliced.length <= 12) {
  // Replace matching items (prefer url, then id) so username changes still merge correctly.
  const byKey = new Map()
  for (const item of existing) {
    const key = item?.url || item?.id
    if (key) byKey.set(key, item)
  }

  let replaced = 0
  for (const item of sliced) {
    const key = item?.url || item?.id
    if (!key) continue
    if (byKey.has(key)) replaced += 1
    byKey.set(key, item)
  }

  const merged = Array.from(byKey.values())
    .filter(Boolean)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  // Keep as many items as we already have (up to 100) to avoid accidental shrinking
  // when env vars aren't loaded (default limit=12).
  const targetLen = Math.min(Math.max(existingCount, sliced.length, 1), 100)
  const mergedFinal = merged.slice(0, targetLen)

  fs.writeFileSync(out, JSON.stringify(mergedFinal, null, 2) + "\n", "utf8")
  console.log(
    `[sync-instagram] WARNING: got only ${sliced.length} items (likely throttled). Merged ${replaced}/${sliced.length} into existing ${existingCount} -> ${out}`
  )
  process.exit(0)
}

fs.writeFileSync(out, JSON.stringify(sliced, null, 2) + "\n", "utf8")
console.log(`[sync-instagram] wrote ${sliced.length} items -> ${out}`)
NODE
}

sync_user() {
  local username="$1"
  local profile_json="$2"
  local out="$3"

  if ! fetch_profile_json "$username" "$profile_json"; then
    if [[ -f "$out" ]]; then
      echo "[sync-instagram] WARNING: failed to refresh @$username. Keeping existing seeds -> $out" >&2
      return 0
    fi
    return 1
  fi
  local user_id
  user_id="$(extract_user_id "$profile_json")"
  if [[ -z "$user_id" ]]; then
    if [[ -f "$out" ]]; then
      echo "[sync-instagram] WARNING: failed to extract user id for @$username. Keeping existing seeds -> $out" >&2
      return 0
    fi
    echo "[sync-instagram] ERROR: failed to extract user id for @$username" >&2
    return 1
  fi

  # Refresh anonymous cookies per user to reduce cross-user throttling.
  ensure_anonymous_cookies

  local ndjson="$TMP_DIR/feed-${username}.ndjson"
  : >"$ndjson"

  local max_id=""
  local page=0
  local collected=0

  while :; do
    page=$((page + 1))
    local feed_json="$TMP_DIR/feed-${username}-${page}.json"

    local attempt=0
    while :; do
      attempt=$((attempt + 1))
      fetch_feed_page "$user_id" "$max_id" "$feed_json" || true

      local status items_count require_login message
      status="$(extract_feed_status "$feed_json" 2>/dev/null || echo "")"
      items_count="$(extract_feed_items_count "$feed_json" 2>/dev/null || echo "0")"
      require_login="$(extract_feed_require_login "$feed_json" 2>/dev/null || echo "false")"
      message="$(extract_feed_message "$feed_json" 2>/dev/null || echo "")"

      if [[ "$status" == "ok" && "$items_count" -gt 0 ]]; then
        break
      fi

      if [[ "$attempt" -ge 5 ]]; then
        break
      fi

      if [[ "$require_login" == "true" || "$message" == *"数分"* ]]; then
        ensure_anonymous_cookies
        sleep 30
      else
        sleep $((attempt * 3))
      fi
    done

    local items_count
    items_count="$(extract_feed_items_count "$feed_json" 2>/dev/null || echo "0")"
    if [[ "$items_count" -le 0 ]]; then
      break
    fi

    append_feed_seeds_ndjson "$username" "$feed_json" "$ndjson"
    collected="$(wc -l <"$ndjson" | tr -d ' ')"
    if [[ "$collected" -ge "$LIMIT" ]]; then
      break
    fi

    max_id="$(extract_feed_next_max_id "$feed_json" 2>/dev/null || echo "")"
    if [[ -z "$max_id" ]]; then
      break
    fi

    if [[ "$page" -ge 10 ]]; then
      # safety stop
      break
    fi

    sleep 2
  done

  if [[ ! -s "$ndjson" ]]; then
    # Fallback: web_profile_info only contains ~12 items, but better than 0.
    node - <<'NODE' "$username" "$profile_json" >"$ndjson"
const fs = require("fs")
const [username, profileFile] = process.argv.slice(2)
const raw = fs.readFileSync(profileFile, "utf8")
const data = JSON.parse(raw)
const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges ?? []

function normalizeSentence(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim()
}

for (const edge of edges) {
  const node = edge?.node
  const code = node?.shortcode
  const takenAt = node?.taken_at_timestamp
  if (!code || !takenAt) continue

  const productType = String(node?.product_type ?? "").toLowerCase()
  const urlKind = productType === "clips" ? "reel" : "p"
  const caption = node?.edge_media_to_caption?.edges?.[0]?.node?.text?.trim?.() ?? ""
  const title = (caption.split(/\r?\n/)[0] || "").trim() || `Instagram post ${code}`
  const summary = normalizeSentence(caption)
  const url = `https://www.instagram.com/${urlKind}/${code}/`
  const date = new Date(takenAt * 1000).toISOString()
  const thumbnail = node?.thumbnail_src?.trim?.() || node?.display_url?.trim?.() || ""

  const seed = {
    id: `ig:${username}:${code}`,
    title,
    date,
    url,
    summary: summary || undefined,
    thumbnail: thumbnail || undefined,
  }

  process.stdout.write(JSON.stringify(seed) + "\n")
}
NODE
  fi

  finalize_seeds_from_ndjson "$ndjson" "$out"
}

BUSINESS_USERNAME="$(normalize_username "$BUSINESS_USERNAME")"
PHOTO_USERNAME="$(normalize_username "$PHOTO_USERNAME")"

TMP_BUSINESS="$TMP_DIR/profile-business.json"
TMP_PHOTO="$TMP_DIR/profile-photo.json"

echo "[sync-instagram] Fetching @$BUSINESS_USERNAME..."
if [[ "$SYNC_ONLY" == "both" || "$SYNC_ONLY" == "business" ]]; then
  sync_user "$BUSINESS_USERNAME" "$TMP_BUSINESS" "$OUT_DIR/instagram-business.json" || true
fi

echo "[sync-instagram] Fetching @$PHOTO_USERNAME..."
if [[ "$SYNC_ONLY" == "both" || "$SYNC_ONLY" == "photo" ]]; then
  sync_user "$PHOTO_USERNAME" "$TMP_PHOTO" "$OUT_DIR/instagram-photo.json" || true
fi
