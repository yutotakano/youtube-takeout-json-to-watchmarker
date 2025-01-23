# YouTube Takeout (JSON) to Watchmarker DB

[Youtube Watchmarker](https://github.com/sniklaus/youtube-watchmarker) is an awesome extension for marking youtube videos as watched. The extension stores all the watched videos in a database that can be exported and imported.

When first installing the extension, it is useful to be able to migrate existing watch history data from YouTube. The script in this repository enables you to do this. The script was originally created by [Jeefongithub](https://github.com/Jeefongithub/youtube-takeout-json-to-watchmarker), which was inspired by the HTML version by [janpaul123](https://github.com/janpaul123/youtube-takeout-to-watchmarker). Modifications have been made to support data formats as recent as 2025/01.

## Usage

Requires Python 3 (at least 3.10) to be installed.

1. Export your YouTube Watch History via [Google Takeout](https://takeout.google.com/settings/takeout/custom/youtube). Make sure to select JSON as the watch history export format. To prevent unnecessarily large exports, make sure to deselect all content types but "history".
2. Wait for Takeout to email you the data. Takes a while but usually less than an hour.
3. Extract the "watch-history.json" file and place it next to the convert.py script
4. Run `python3 convert.py`. Verify that the output doesn't have any errors.
5. A file called `watch-history.converted.database` should now be created, ready to be imported.
