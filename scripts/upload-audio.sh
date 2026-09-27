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
    # Try each file 3 times (slow home uploads sometimes drop); after that, stop this pass and retry next run
    tries=0
    until npx -y wrangler r2 object put "$BUCKET/$file" --file "$file" --remote \
      --content-type "$type" --cache-control 'public, max-age=86400' >/dev/null 2>&1; do
      tries=$((tries + 1))
      [ $tries -lt 3 ] || { echo "failed $file"; exit 1; }
      sleep 30
    done
    echo "$file" >> .uploaded
    echo "uploaded $file"
  done
done
