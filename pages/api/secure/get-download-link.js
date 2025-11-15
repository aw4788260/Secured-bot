import YTDlpWrap from "yt-dlp-wrap";

export default async function handler(req, res) {
  try {
    // [ ✅ تعديل: اقبل url أو youtubeId ]
    const { url, youtubeId } = req.query;
    const videoUrl = url || youtubeId; // استخدم أياً منهما

    if (!videoUrl) {
      // [ ✅ تعديل: تحديث رسالة الخطأ ]
      return res.status(400).json({ error: "No URL or youtubeId provided" });
    }

    const ytdlp = new YTDlpWrap();

    // Get JSON metadata
    const jsonOutput = await ytdlp.execPromise([
      videoUrl, // [ ✅ تعديل: استخدم المتغير الجديد ]
      "--dump-single-json",
      "--no-warnings",
      "--prefer-free-formats"
    ]);

    const data = JSON.parse(jsonOutput);

    // Extract best format link
    const bestFormat =
      data.formats?.find((f) => f.url && f.acodec !== "none" && f.vcodec !== "none") ||
      data.formats?.find((f) => f.url);

    if (!bestFormat) {
      return res.status(500).json({ error: "No downloadable format found" });
    }

    res.status(200).json({
      title: data.title,
      url: bestFormat.url
    });
  } catch (error) {
    console.error("yt-dlp error:", error);
    res.status(500).json({ error: error.message || "Unknown error" });
  }
}
