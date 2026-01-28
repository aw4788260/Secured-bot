export default function handler(req, res) {
  res.status(200).json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key_part: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 5) : 'NONE'
  });
}
