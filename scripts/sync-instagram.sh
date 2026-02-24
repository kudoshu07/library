#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/content/external"
TMP_DIR="${TMPDIR:-/tmp}/ksl-instagram-sync"
mkdir -p "$OUT_DIR" "$TMP_DIR"

UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
APP_ID='936619743392459'
ASBD_ID='129477'

BUSINESS_USERNAME="${IG_BUSINESS_USERNAME:-kudoshu_vcook}"
PHOTO_USERNAME="${IG_PHOTO_USERNAME:-0n0shu}"
LIMIT="${INSTAGRAM_FETCH_LIMIT:-12}"

normalize_username() {
  echo "$1" | sed -E 's/^@//' | tr -d '[:space:]'
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

write_seeds() {
  local username="$1"
  local infile="$2"
  local out="$3"

  node - <<'NODE' "$username" "$infile" "$out" "$LIMIT"
const fs = require("fs")

const [username, infile, out, limitRaw] = process.argv.slice(2)
const limit = Math.min(Math.max(parseInt(limitRaw || "12", 10) || 12, 1), 30)

function normalizeSentence(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim()
}

function toSeed(username, node) {
  const shortcode = node && node.shortcode
  const takenAt = node && node.taken_at_timestamp
  if (!shortcode || !takenAt) return null

  const caption = node?.edge_media_to_caption?.edges?.[0]?.node?.text?.trim?.() ?? ""
  const title = (caption.split(/\r?\n/)[0] || "").trim() || `Instagram post ${shortcode}`
  const summary = normalizeSentence(caption)

  const url = `https://www.instagram.com/p/${shortcode}/`
  const date = new Date(takenAt * 1000).toISOString()
  const thumbnail = node?.thumbnail_src?.trim?.() || node?.display_url?.trim?.()

  return {
    id: `ig:${username}:${shortcode}`,
    title,
    date,
    url,
    summary: summary || undefined,
    thumbnail: thumbnail || undefined,
  }
}

const raw = fs.readFileSync(infile, "utf8")
const data = JSON.parse(raw)
const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges ?? []
const seeds = edges
  .map((e) => toSeed(username, e?.node))
  .filter(Boolean)
  .slice(0, limit)
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

fs.writeFileSync(out, JSON.stringify(seeds, null, 2) + "\n", "utf8")
console.log(`[sync-instagram] @${username}: ${seeds.length} items -> ${out}`)
NODE
}

BUSINESS_USERNAME="$(normalize_username "$BUSINESS_USERNAME")"
PHOTO_USERNAME="$(normalize_username "$PHOTO_USERNAME")"

TMP_BUSINESS="$TMP_DIR/profile-business.json"
TMP_PHOTO="$TMP_DIR/profile-photo.json"

echo "[sync-instagram] Fetching @$BUSINESS_USERNAME..."
fetch_profile_json "$BUSINESS_USERNAME" "$TMP_BUSINESS"
write_seeds "$BUSINESS_USERNAME" "$TMP_BUSINESS" "$OUT_DIR/instagram-business.json"

echo "[sync-instagram] Fetching @$PHOTO_USERNAME..."
fetch_profile_json "$PHOTO_USERNAME" "$TMP_PHOTO"
write_seeds "$PHOTO_USERNAME" "$TMP_PHOTO" "$OUT_DIR/instagram-photo.json"
