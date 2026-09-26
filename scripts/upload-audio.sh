#!/bin/sh
# Uploads finished recordings from audio/ to the Cloudflare R2 bucket the live site reads (VITE_AUDIO_BASE).
# Only files not uploaded before are sent (tracked in audio/.uploaded), so run it again as recording goes on.
#   sh scripts/upload-audio.sh
set -e
BUCKET=voice-bible-audio
# WSL often has no working IPv6, and Node tries it first, so uploads fail with "fetch failed"
export NODE_OPTIONS=--dns-result-order=ipv4first
cd "$(dirname "$0")/../audio"
touch .uploaded

# A chapter is finished once its .json exists (record-kokoro.py writes it last); send its .mp3 before the .json
find . -name '*.json' | sed 's|^\./||' | sort | while read -r json; do
  for file in "${json%.json}.mp3" "$json"; do
    grep -qxF "$file" .uploaded && continue
    case $file in *.mp3) type=audio/mpeg ;; *) type=application/json ;; esac
    # On a failed upload, stop this pass; the next run retries from the same file
    npx -y wrangler r2 object put "$BUCKET/$file" --file "$file" --remote \
      --content-type "$type" --cache-control 'public, max-age=86400' >/dev/null 2>&1 || { echo "failed $file"; exit 1; }
    echo "$file" >> .uploaded
    echo "uploaded $file"
  done
done
