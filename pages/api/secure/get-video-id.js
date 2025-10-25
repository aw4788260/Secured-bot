// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { lessonId } = req.query;
  if (!lessonId) {
    return res.status(400).json({ message: 'Missing lessonId' });
  }
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('youtube_video_id')
      .eq('id', lessonId)
      .single();
    if (error || !data) {
      throw new Error('Video not found or permission denied');
    }
    res.status(200).json({ youtube_video_id: data.youtube_video_id });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};
