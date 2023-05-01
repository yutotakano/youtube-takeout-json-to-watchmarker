import json
import base64

with open('watch-history.json') as f:
    data = json.load(f)

results = []
for item in data:
    video_id = item['contentDetails']['videoId']
    title = item['snippet']['title']
    results.append({"strIdent":video_id,"intTimestamp":1665544742774,"title":title,"intCount":1})

encoded_data = base64.b64encode(json.dumps(results).encode()).decode()

with open('takeoutjson.database', 'w') as f:
    f.write(encoded_data)
