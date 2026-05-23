import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
    const { fingerprint } = req.query;
    if (!fingerprint) return res.status(400).json({ hasPlayed: false });

    const { data } = await supabase
        .from('wheel_spins')
        .select('id')
        .eq('browser_fingerprint', fingerprint)
        .maybeSingle();

    // إذا وجدنا سجلاً، الطالب قد لعب (true)، إذا لم نجد (false)
    return res.status(200).json({ hasPlayed: !!data });
}
