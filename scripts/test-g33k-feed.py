import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('g33k_feed', Path(__file__).with_name('sync-g33k-feed.py'))
feed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(feed)


def xml(channel=feed.CHANNEL, video='t0VX_36rGQk'):
    return f'''<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015">
    <yt:channelId>{channel[2:]}</yt:channelId><entry><yt:channelId>{channel}</yt:channelId>
    <yt:videoId>{video}</yt:videoId><title>G33K TEAM &amp; Go</title>
    <published>2026-10-07T18:00:00+00:00</published></entry></feed>'''


class FeedTests(unittest.TestCase):
    def test_valid_channel_and_video(self):
        data = feed.parse_feed(xml())
        self.assertEqual(data['videos'][0]['title'], 'G33K TEAM & Go')
        self.assertEqual(data['videos'][0]['url'], 'https://www.youtube.com/watch?v=t0VX_36rGQk')

    def test_wrong_channel_and_invalid_video(self):
        for bad in [xml('UCwrongchannel'), xml(video='bad'), xml().replace('2026-10-07', 'invalid')]:
            with self.assertRaises(ValueError):
                feed.parse_feed(bad)

    def test_outage_keeps_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'feed.json'
            output.write_text(json.dumps(feed.parse_feed(xml())))
            before = output.read_bytes()
            with patch.object(feed, 'OUTPUT', output), patch('urllib.request.urlopen', side_effect=OSError('offline')), patch('sys.argv', ['sync']):
                self.assertEqual(feed.main(), 0)
            self.assertEqual(output.read_bytes(), before)

    def test_outage_without_snapshot_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(feed, 'OUTPUT', Path(directory) / 'missing.json'), patch('urllib.request.urlopen', side_effect=OSError('offline')), patch('sys.argv', ['sync']):
                self.assertEqual(feed.main(), 1)


if __name__ == '__main__':
    unittest.main()
