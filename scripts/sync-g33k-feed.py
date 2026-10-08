#!/usr/bin/env python3
"""Cache YouTube channel RSS for Jekyll; preserve the last good feed on outages."""
import argparse
import datetime as dt
import json
from pathlib import Path
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CHANNEL = 'UCmhVhM793njn02ArOCv3yDA'
FEED = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL
OUTPUT = ROOT / '_data/g33k-videos.json'
NS = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015'}


def parse_feed(xml):
    root = ET.fromstring(xml)
    # YouTube omits UC in the feed-level channelId, but includes it on entries.
    if root.findtext('yt:channelId', namespaces=NS) not in (CHANNEL, CHANNEL[2:]):
        raise ValueError('Unexpected YouTube channel')
    videos, seen = [], set()
    for entry in root.findall('a:entry', NS):
        video_id = entry.findtext('yt:videoId', default='', namespaces=NS)
        title = entry.findtext('a:title', default='', namespaces=NS).strip()
        published = entry.findtext('a:published', default='', namespaces=NS)
        if entry.findtext('yt:channelId', namespaces=NS) != CHANNEL:
            raise ValueError('Entry belongs to another channel')
        if not re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id) or not title:
            raise ValueError('Invalid video entry')
        dt.datetime.fromisoformat(published.replace('Z', '+00:00'))
        if video_id in seen:
            continue
        seen.add(video_id)
        videos.append({'id': video_id, 'title': title, 'published': published,
                       'url': 'https://www.youtube.com/watch?v=' + video_id,
                       'thumbnail': 'https://i.ytimg.com/vi/' + video_id + '/hqdefault.jpg'})
    if not videos:
        raise ValueError('Empty channel feed')
    videos.sort(key=lambda video: video['published'], reverse=True)
    return {'channel_id': CHANNEL, 'feed_url': FEED,
            'updated_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'videos': videos}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--strict', action='store_true')
    args = parser.parse_args()
    try:
        req = urllib.request.Request(FEED, headers={'User-Agent': 'aitorOS-channel-feed/1.0'})
        with urllib.request.urlopen(req, timeout=25) as response:
            data = parse_feed(response.read(2_000_000))
        tmp = OUTPUT.with_suffix('.tmp')
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        tmp.replace(OUTPUT)
        print(f"G33K TEAM: {len(data['videos'])} videos refreshed from channel RSS")
        return 0
    except Exception as error:
        print(f'G33K TEAM feed unavailable: {error}', file=sys.stderr)
        if args.strict or not OUTPUT.exists():
            return 1
        cached = json.loads(OUTPUT.read_text(encoding='utf-8'))
        if cached.get('channel_id') != CHANNEL or not cached.get('videos'):
            return 1
        print('Keeping last known channel feed; build can continue.')
        return 0


if __name__ == '__main__':
    sys.exit(main())
