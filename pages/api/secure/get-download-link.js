import ytDlp from "yt-dlp-exec";

export default async function handler(req, res) {
  const { youtubeId } = req.query;

  if (!youtubeId) {
    return res.status(400).json({ error: "Missing youtubeId" });
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

    const result = await ytDlp(videoUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });

    if (!result || !result.formats) {
      return res.status(500).json({ error: "No formats available" });
    }

    const bestFormat = result.formats
      .filter(f => f.ext === "mp4" && f.url)
      .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

    if (!bestFormat) {
      return res.status(500).json({ error: "No direct mp4 link found" });
    }

    return res.status(200).json({
      downloadUrl: bestFormat.url,
      quality: bestFormat.height,
    });

  } catch (err) {
    console.error("Download error:", err);
    return res.status(500).json({ error: "yt-dlp failed", details: err.message });
  }
}
