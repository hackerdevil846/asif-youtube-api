require('dotenv').config();
const express = require("express");
const yts = require("yt-search");
const ytdl = require("ytdl-core");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "mysecret123";

app.use(express.json());
app.use(helmet());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Too many requests, please try again later." }
});
app.use(limiter);

app.use((req, res, next) => {
  const key = req.headers["x-api-key"] || req.query.api_key;
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized: Invalid or missing API key" });
  }
  next();
});

app.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query)
    return res.status(400).json({ error: "Query parameter 'q' is required" });

  try {
    const result = await yts(query);
    const videos = result.videos.slice(0, 10).map(video => ({
      title: video.title,
      videoId: video.videoId,
      url: video.url,
      duration: video.timestamp,
      views: video.views,
      author: video.author.name,
      thumbnail: video.thumbnail
    }));

    res.json({ videos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch search results" });
  }
});

app.get("/download", async (req, res) => {
  const videoId = req.query.id;
  const type = (req.query.type || "mp4").toLowerCase();
  const quality = req.query.quality;

  if (!videoId)
    return res.status(400).json({ error: "Query parameter 'id' is required" });

  if (!["mp3", "mp4"].includes(type))
    return res.status(400).json({ error: "Invalid 'type' parameter, must be 'mp3' or 'mp4'" });

  try {
    const info = await ytdl.getInfo(videoId);
    let formats = ytdl.filterFormats(info.formats, type === "mp4" ? "videoandaudio" : "audioonly");

    let format;

    if (quality) {
      if (type === "mp4") {
        format = formats.find(f => f.qualityLabel === quality) || formats[0];
      } else {
        format = formats.find(f => f.audioBitrate && `${f.audioBitrate}kbps` === quality) || formats[0];
      }
    } else {
      format = formats.find(f => f.qualityLabel === "360p") || formats[0];
    }

    if (!format)
      return res.status(404).json({ error: "Suitable format not found" });

    res.json({
      title: info.videoDetails.title,
      videoId,
      quality: format.qualityLabel || `${format.audioBitrate}kbps`,
      downloadLink: format.url,
      thumbnail: info.videoDetails.thumbnails[0]?.url || null,
      lengthSeconds: info.videoDetails.lengthSeconds,
      author: info.videoDetails.author.name
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch download info" });
  }
});

app.listen(PORT, () => {
  console.log(`YouTube API server running on port ${PORT}`);
});
