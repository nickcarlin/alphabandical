#!/bin/sh
set -e
cd "$(dirname "$0")"

mariadb -N -B songs -e "
SELECT id, artist, title, album, year, time, challenge, chooser
FROM allsongs ORDER BY id;
" > songs.tsv

jq -R -s 'split("\n") | map(select(length > 0) | split("\t") | {
  id: (.[0] | tonumber),
  artist: .[1],
  title: .[2],
  album: .[3],
  year: (.[4] | tonumber),
  time: (.[5] | tonumber),
  challenge: .[6],
  chooser: .[7]
})' songs.tsv > songs.json

rm songs.tsv
echo "exported $(jq 'length' songs.json) rows"
