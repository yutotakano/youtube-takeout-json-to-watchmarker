const INPUT_FILE = "watch-history-2016.json"
const OUTPUT_FILE = "watch-history.converted.database"

/**
 * A class representing a parsed watch history entry with only the metadata
 * relevant for watchmarker.
 */
class WatchHistoryEntry {
  constructor(video_id, timestamp, title) {
    this.video_id = video_id
    this.timestamp = timestamp
    this.title = title
  }
}

/**
 * Parser for the old playlist history format (circa 2016?). The only example
 * available is from 2016 and is saved as watch-history-2016.json in this
 * repository.
 */
class PlaylistHistoryFormatParser {
  /**
   * Parses an entry in the old playlist history format of watch history. This
   * format does not have a timestamp so the converted entry will have the
   * current timestamp as the watch timestamp instead.
   * @param {object} item An array item from the input JSON
   * @param {*} logFunction Log function that accepts a severity and a message
   * @returns A parsed WatchHistoryEntry
   */
  static processEntry(item, logFunction) {
    if (!item.hasOwnProperty("contentDetails")) {
      logFunction("info", "Problematic entry: " + JSON.stringify(item))
      throw new Error("contentDetails not in item. Please file a bug report!")
    }

    let videoId = item["contentDetails"]["videoId"]
    // The old format does not have a timestamp (it's more like a playlist)
    // so we will use the current time
    let timestamp = Date.now()
    let title = item["snippet"]["title"]

    return new WatchHistoryEntry(videoId, timestamp, title)
  }
}

/**
 * Parser for the new watch history format. This format is the one that is
 * currently used by YouTube and is the one that is exported from Google Takeout.
 */
class NewFormatParser {
  /**
   * Parse the video ID from a YouTube URL.
   * @param {string} url The contents of the "titleURL" field in the JSON
   * @returns YouTube video ID or null if it couldn't be parsed
   */
  static parseVideoId(url) {
    if (url.includes("https://www.youtube.com/watch?v=")) {
      return url.split("https://www.youtube.com/watch?v=")[1].split("&")[0]
    }
    if (url.includes("https://music.youtube.com/watch?v=")) {
      return url.split("https://music.youtube.com/watch?v=")[1].split("&")[0]
    }
    return null
  }

  /**
   * Parse a timestamp.
   * @param {string} time The "time" field contents, e.g. "2023-11-18T20:51:04.917Z"
   * @returns The timestamp in milliseconds since epoch
   */
  static parseTime(time) {
    return new Date(time).getTime()
  }

  /**
   * Process an entry in the new watch history format.
   * @param {object} item An array item from the input JSON
   * @param {*} logFunction Log function that accepts a severity and a message
   * @returns A parsed WatchHistoryEntry or null if the entry should be skipped
   */
  static processEntry(item, logFunction) {
    if (
      item.hasOwnProperty("title") &&
      item["title"] == "Viewed Ads On YouTube Homepage"
    ) {
      // Skip this because ads are an entry for some reason??
      logFunction("info", `Skipping ad view entry on ${item["time"]}`)
      return null
    }

    if (
      item.hasOwnProperty("titleUrl") &&
      item["titleUrl"].includes("https://www.youtube.com/post/")
    ) {
      // Skip if it's a view of a community post - there is no video ID
      logFunction("info", `Skipping community post view entry on ${item["time"]}`)
      return null
    }

    if (item.hasOwnProperty("title") && item["title"].startsWith("Visited ")) {
      // Skip if it's a visit to a website - there is no video ID
      let domain = item["titleUrl"].split("://")[1].split("/")[0]
      logFunction("info", `Skipping website visit entry (to ${domain}) on ${item["time"]}`)
      return null
    }

    // Just in case: handle the cases when the expected keys are not present
    // and prompt for a bug report
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

/**
 * 
 * @param {object[]} input The JSON from the YouTube watch history export
 * @param {*} logFunction Log function that accepts a severity and a message
 * @returns An array of watchmarker-compatible watch history objects
 */
function convert(input, logFunction) {
  // We'll store the results in an object (with the video ID as the key) instead
  // of an array. This is so we can easily check for duplicates and increment
  // the count of the video instead of adding a new entry.
  // At the end, we'll convert it back to an array since that's what watchmarker
  // expects.
  let converted = {}

  // Keep track of how many entries were skipped so we can log them at the end
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
 * Logger function to be used with the conversion function. This function is
 * for logging messages to the console, and is primarily for when the script
 * is run directly with Node.js.
 * @param {string} severity Severity of the log message
 * @param {string} message Log message
 */
function consoleLogger(severity, message) {
  if (severity == "error") {
    console.error(`[${severity}] ${message}`)
  } else {
    console.log(`[${severity}] ${message}`)
  }
}

// If this script is run directly with node, read the input file and
// run the conversion. We detect this by checking if the require.main
// module is this module.
if (typeof require !== 'undefined' && require !== undefined && require.main == module) {
  let fs = require("fs")

  // Decode input file as base64, read as JSON, and pass it to convert()
  let input = JSON.parse(fs.readFileSync(INPUT_FILE).toString())
  let output = convert(input, consoleLogger)
  // Like with the web version, we need to use the deprecated unescape function
  // to make the output compatible with the watchmarker expected format
  let base64_output = btoa(unescape(encodeURIComponent(JSON.stringify(output))))

  fs.writeFileSync(OUTPUT_FILE, base64_output)
}
