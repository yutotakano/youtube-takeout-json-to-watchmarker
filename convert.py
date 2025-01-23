import json
import base64
from datetime import datetime

input_file = "watch-history.json"
output_file = "watch-history.converted.database"


class PlaylistHistoryFormatParser:
    """Process entries from the old watch history data format. The only example
    available is from 2016 and is available as watch-history-2016.json in this
    repository.
    """

    def process_entry(
        self, item: dict[str, dict[str, str]]
    ) -> tuple[str, int, str] | None:
        if "contentDetails" not in item:
            print("contentDetails not in item. Please file a bug report!")
            print("Problematic entry:", item)
            exit(1)

        video_id = item["contentDetails"]["videoId"]
        # The old format does not have a timestamp (it's more like a playlist)
        # so we will use the current timestamp instead
        timestamp = int(datetime.today().timestamp() * 1000)
        title = item["snippet"]["title"]

        return video_id, timestamp, title


class NewFormatParser:
    def parse_video_id(self, url: str) -> str | None:
        # Parse https://www.youtube.com/watch?v\u003d{video_id}

        if "https://www.youtube.com/watch?v=" in url:
            return url.split("https://www.youtube.com/watch?v=")[1].split("&")[0]

        if "https://music.youtube.com/watch?v=" in url:
            return url.split("https://music.youtube.com/watch?v=")[1].split("&")[0]

    def parse_time(self, time: str) -> int:
        # Parse "2023-11-18T20:51:04.917Z" into Unix Epoch (milliseconds)
        dt = datetime.fromisoformat(time)
        return int(dt.timestamp() * 1000)

    def process_entry(self, item: dict[str, str]) -> tuple[str, int, str] | None:
        """Parse an entry from the new JSON format into a tuple of video ID,
        timestamp, and title.

        Parameters
        ----------
        entry : dict
            JSON entry from the new format

        Returns
        -------
        tuple[str, int, str]
            Video ID, timestamp and title
        """

        if "Viewed Ads On YouTube Homepage" == item["title"]:
            print(f"Skipping ad view entry on {item['time']}")
            # Skip this because it's an entry for some reason??
            return

        # Skip if it's a view of a community post
        if "https://www.youtube.com/post/" in item["titleUrl"]:
            print(f"Skipping community post view entry on {item['time']}")
            return

        if item["title"].startswith("Visited "):
            domain = item["titleUrl"].split("://")[1].split("/")[0]
            print(f"Skipping website visit entry (to {domain}) on {item['time']}")
            return

        if not item["title"].startswith("Watched "):
            print(
                "Unexpected value for key 'title', expected it to begin with 'Watched'. Please file a bug report!"
            )
            print("Problematic entry:", item)
            exit(1)

        video_id = self.parse_video_id(item["titleUrl"])
        if not video_id:
            print("Video ID couldn't parsed from URL. Please file a bug report!")
            print("Problematic entry:", item)
            exit(1)

        title = item["title"].split("Watched ")[1]  # Remove "Watched " from the title
        if len(title.strip()) == 0 or len(video_id.strip()) == 0:
            print("Title or video ID is empty. Please file a bug report!")
            print("Problematic entry:", item)
            exit(1)

        timestamp = self.parse_time(item["time"])

        return video_id, timestamp, title


if __name__ == "__main__":
    with open(input_file) as f:
        data = json.load(f)

    # The results will be stored in a dictionary with the video ID as the key
    # and the value as a dictionary containing the video ID, timestamp, title,
    # and the count of how many times the video was watched.
    # At the end, we will convert this dictionary into a list since that is the
    # expected format by youtube-watchmarker, but during processing we need a
    # quick way to look-up an entry by video ID (for counting rewatches), so we
    # use a dict.
    results = {}

    # Keep track of how many entries were skipped so we can print a summary at
    # the end
    skipped = 0
    skipped_due_to_duplicate = 0

    # Create instances of the parsers
    old_parser = PlaylistHistoryFormatParser()
    new_parser = NewFormatParser()

    for item in data:
        if "contentDetails" in item:
            parsed_entry = old_parser.process_entry(item)
        else:
            parsed_entry = new_parser.process_entry(item)

        if not parsed_entry:
            skipped += 1
            continue

        video_id, timestamp, title = parsed_entry

        # If the entry is already in the results, increment the count and use the
        # latest timestamp
        if video_id in results:
            results[video_id]["intCount"] += 1
            results[video_id]["intTimestamp"] = max(
                results[video_id]["intTimestamp"], timestamp
            )
            skipped_due_to_duplicate += 1
        else:
            results[video_id] = {
                "strIdent": video_id,
                "intTimestamp": timestamp,
                "strTitle": title,
                "intCount": 1,
            }

    results = list(results.values())

    print("--------------")
    print(f"{input_file} -> {output_file}")
    print("--------------")
    print(f"Original: {len(data)} entries")
    print(
        f"Skipped: {skipped} entries (non-video history such as ads, community posts, website visits)"
    )
    print(
        f"Converted: {len(results)} unique videos (and {skipped_due_to_duplicate} re-watches)"
    )

    encoded_data = base64.b64encode(json.dumps(results).encode())

    with open(output_file, "wb") as f:
        f.write(encoded_data)
