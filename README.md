# youtube-takeout-json-to-watchmarker

Youtube Watchmarker is an awesome extension for marking youtube videos as watched. Here is a link to the repo by sniklaus
https://github.com/sniklaus/youtube-watchmarker

The extension stores all the watched videos in a database that can be exported and imported

Youtube watch history is apart of the google takeout feature and the goal of this was to convert the takeout watch history to the database format to import into watchmarker

Newer takeout data saves the export as watch-history.html which janpaul123 already wrote code for https://github.com/janpaul123/youtube-takeout-to-watchmarker

older takeout data stores the history as watch-history.json which is the goal for this repo. As it sits currently the data is extracted from the json, reorganized, encoded base64, then exported as a .database file. The file can be imported into watchmarker but it doesn't save. My guess is im just missing a comma or something somewhere but it's late I can can't figure it out for the life of me. I'll upload the cutdown sample data json if anyone wants to give it a shot

#test commit