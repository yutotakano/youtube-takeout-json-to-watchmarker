const INPUT_FILE = "watch-history-2016.json"
const OUTPUT_FILE = "watch-history.converted.database"

class WatchHistoryEntry {
  constructor(video_id, timestamp, title) {
    this.video_id = video_id
    this.timestamp = timestamp
    this.title = title
  }
}

class PlaylistHistoryFormatParser {
  static processEntry(item, logFunction) {
    if (!item.hasOwnProperty("contentDetails")) {
      console.log("Problematic entry:", item)
      throw new Error("contentDetails not in item. Please file a bug report!")
    }

    let videoId = item["contentDetails"]["videoId"]
    // The old format does not have a timestamp (it's more like a playlist)
    // so we will use the current timestamp instead
    let timestamp = Date.now()
    let title = item["snippet"]["title"]

    return new WatchHistoryEntry(videoId, timestamp, title)
  }
}

class NewFormatParser {
  static parseVideoId(url) {
    if (url.includes("https://www.youtube.com/watch?v=")) {
      return url.split("https://www.youtube.com/watch?v=")[1].split("&")[0]
    }
    if (url.includes("https://music.youtube.com/watch?v=")) {
      return url.split("https://music.youtube.com/watch?v=")[1].split("&")[0]
    }
    return null
  }

  static parseTime(time) {
    return new Date(time).getTime()
  }

  static processEntry(item, logFunction) {
    if (
      item.hasOwnProperty("title") &&
      item["title"] == "Viewed Ads On YouTube Homepage"
    ) {
      // Skip this because it's an entry for some reason??
      logFunction("info", `Skipping ad view entry on ${item["time"]}`)
      return null
    }

    if (
      item.hasOwnProperty("titleUrl") &&
      item["titleUrl"].includes("https://www.youtube.com/post/")
    ) {
      // Skip if it's a view of a community post
      logFunction("info", `Skipping community post view entry on ${item["time"]}`)
      return null
    }

    if (item.hasOwnProperty("title") && item["title"].startsWith("Visited ")) {
      let domain = item["titleUrl"].split("://")[1].split("/")[0]
      logFunction("info", `Skipping website visit entry (to ${domain}) on ${item["time"]}`)
      return null
    }

    if (!item.hasOwnProperty("title")) {
      logFunction("info", "Problematic entry: " + JSON.stringify(item))
      throw new Error("title not in item. Please file a bug report!")
    }

    if (!item.hasOwnProperty("titleUrl")) {
      logFunction("info", "Problematic entry: " + JSON.stringify(item))
      throw new Error("titleUrl not in item. Please file a bug report!")
    }

    if (!item["title"].startsWith("Watched ")) {
      logFunction("info", "Problematic entry: " + JSON.stringify(item))
      throw new Error(
        "Unexpected value for key 'title', expected it to begin with 'Watched'. Please file a bug report!"
      )
    }

    let videoId = NewFormatParser.parseVideoId(item["titleUrl"])
    if (!videoId) {
      logFunction("info", "Problematic entry: " + JSON.stringify(item))
      throw new Error(
        "Video ID couldn't parsed from URL. Please file a bug report!"
      )
    }

    let title = item["title"].split("Watched ")[1] // Remove "Watched " from the title

    if (title.trim().length == 0 || videoId.trim().length == 0) {
      logFunction("info", "Title or video ID is empty. Please file a bug report!")
      logFunction("info", "Problematic entry: " + JSON.stringify(item))
      throw new Error("Title or video ID is empty. Please file a bug report!")
    }

    let timestamp = NewFormatParser.parseTime(item["time"])

    return new WatchHistoryEntry(videoId, timestamp, title)
  }
}

function convert(input, logFunction) {
  let converted = {}

  let skipped = 0
  let skipped_due_to_duplicate = 0

  logFunction("info", `Processing ${input.length} entries`)

  for (let item of input) {
    let entry = null

    if (item.hasOwnProperty("contentDetails")) {
      entry = PlaylistHistoryFormatParser.processEntry(item, logFunction)
    } else {
      entry = NewFormatParser.processEntry(item, logFunction)
    }

    if (!entry) {
      skipped++
      continue
    }

    if (converted.hasOwnProperty(entry.video_id)) {
      // If the entry is already in the results, increment the count and
      // use the latest timestamp
      skipped_due_to_duplicate++
      converted[entry.video_id]["intCount"]++
      converted[entry.video_id]["intTimestamp"] = Math.max(
        converted[entry.video_id]["intTimestamp"],
        entry.timestamp
      )
    } else {
      converted[entry.video_id] = {
        strIdent: entry.video_id,
        intTimestamp: entry.timestamp,
        strTitle: entry.title,
        intCount: 1
      }
    }
  }

  logFunction("-----------------------------------")
  logFunction(
    "info",
    `Skipped: ${skipped} entries (non-video history such as ads, community posts, website visits)`
  )
  logFunction("info", `Converted: ${Object.keys(converted).length} unique videos (and ${skipped_due_to_duplicate} re-watches)`)

  if (Object.keys(converted).length > 1) {
    logFunction("info", "Preview of first two converted entries:")
    logFunction("info", JSON.stringify(Object.values(converted).slice(0, 2), null, 2))
  }

  return Object.values(converted)
}

/**
*  Base64 encode function courtesy of: http://www.webtoolkit.info/
**/
var Base64 = {
  // private property
  _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

  // public method for encoding
  encode : function (input) {
      var output = "";
      var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
      var i = 0;

      input = Base64._utf8_encode(input);

      while (i < input.length) {

          chr1 = input.charCodeAt(i++);
          chr2 = input.charCodeAt(i++);
          chr3 = input.charCodeAt(i++);

          enc1 = chr1 >> 2;
          enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
          enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
          enc4 = chr3 & 63;

          if (isNaN(chr2)) {
              enc3 = enc4 = 64;
          } else if (isNaN(chr3)) {
              enc4 = 64;
          }

          output = output +
          this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
          this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
      }
      return output;
  },

  // private method for UTF-8 encoding
  _utf8_encode : function (string) {
      string = string.replace(/\r\n/g,"\n");
      var utftext = "";

      for (var n = 0; n < string.length; n++) {

          var c = string.charCodeAt(n);

          if (c < 128) {
              utftext += String.fromCharCode(c);
          }
          else if((c > 127) && (c < 2048)) {
              utftext += String.fromCharCode((c >> 6) | 192);
              utftext += String.fromCharCode((c & 63) | 128);
          }
          else {
              utftext += String.fromCharCode((c >> 12) | 224);
              utftext += String.fromCharCode(((c >> 6) & 63) | 128);
              utftext += String.fromCharCode((c & 63) | 128);
          }
      }
      return utftext;
  },
}

function consoleLogger(severity, message) {
  if (severity == "error") {
    console.error(`[${severity}] ${message}`)
  } else {
    console.log(`[${severity}] ${message}`)
  }
}

// If this script is run directly with node, read the input file and
// run the conversion
if (typeof require !== 'undefined' && require !== undefined && require.main == module) {
  let fs = require("fs")

  // Decode input file as base64, read as JSON, and pass it to convert()
  let input = JSON.parse(fs.readFileSync(INPUT_FILE).toString())
  let output = convert(input, consoleLogger)
  let base64_output = Buffer.from(JSON.stringify(output)).toString(
    "base64"
  )

  fs.writeFileSync(OUTPUT_FILE, base64_output)
}
