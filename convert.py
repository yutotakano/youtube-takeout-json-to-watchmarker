import json
import base64
from datetime import datetime


def parse_video_id(url: str) -> str | None:
    # Parse https://www.youtube.com/watch?v\u003d{video_id}

    if "https://www.youtube.com/watch?v=" in url:
        return url.split("https://www.youtube.com/watch?v=")[1].split("&")[0]

    if "https://music.youtube.com/watch?v=" in url:
        return url.split("https://music.youtube.com/watch?v=")[1].split("&")[0]


def parse_time(time: str) -> int:
    # Parse "2023-11-18T20:51:04.917Z" into Unix Epoch (milliseconds)
    dt = datetime.fromisoformat(time)
    return int(dt.timestamp() * 1000)


with open("watch-history.json") as f:
    data = json.load(f)

results = {}

skipped = 0
skipped_due_to_duplicate = 0

for item in data:
    if "Viewed Ads On YouTube Homepage" == item["title"]:
        print(f"Skipping ad view entry on {item['time']}")
        # Skip this because it's an entry for some reason??
        skipped += 1
        continue

    # Skip if it's a view of a community post
    if "https://www.youtube.com/post/" in item["titleUrl"]:
        print(f"Skipping community post view entry on {item['time']}")
        skipped += 1
        continue

    if item["title"].startswith("Visited "):
        domain = item["titleUrl"].split("://")[1].split("/")[0]
        print(f"Skipping website visit entry (to {domain}) on {item['time']}")
        skipped += 1
        continue

    if not item["title"].startswith("Watched "):
        print(
            "Unexpected value for key 'title', expected it to begin with 'Watched'. Please file a bug report!"
        )
        print("Problematic entry:", item)
        exit(1)

    video_id = parse_video_id(item["titleUrl"])
    if not video_id:
        print("Video ID couldn't parsed from URL. Please file a bug report!")
        print("Problematic entry:", item)
        exit(1)

    title = item["title"].split("Watched ")[1]  # Remove "Watched " from the title
    if len(title.strip()) == 0 or len(video_id.strip()) == 0:
        print("Title or video ID is empty. Please file a bug report!")
        print("Problematic entry:", item)
        exit(1)

    timestamp = parse_time(item["time"])

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
print(f"Original: {len(data)} entries")
print(
    f"Skipped: {skipped} entries (non-video history such as ads, community posts, website visits)"
)
print(
    f"Converted: {len(results)} unique videos (and {skipped_due_to_duplicate} re-watches)"
)

encoded_data = base64.b64encode(json.dumps(results).encode())

with open("converted.database", "wb") as f:
    f.write(encoded_data)
