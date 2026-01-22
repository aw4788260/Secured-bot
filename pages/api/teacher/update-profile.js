import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // المدرس الرئيسي فقط هو من يعدل بيانات البروفايل (ليس المشرف)
  if (auth.role !== 'teacher') {
      return res.status(403).json({ error: 'Only the main teacher can edit profile details' });
  }

  const { name, bio, specialty, vodafoneCash, instapay } = req.body;

  try {
    const { error } = await supabase
      .from('teachers')
      .update({
        name: name,
        bio: bio,
        specialty: specialty,
        vodafone_cash_number: vodafoneCash,
        instapay_number: instapay,
        // يمكن إضافة instapay_link إذا كنت تستخدمه
      })
      .eq('id', auth.teacherId);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Profile updated successfully' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
