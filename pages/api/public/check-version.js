// pages/api/public/check-version.js
import { supabase } from '../../../lib/supabaseClient';
import admin from '../../../lib/firebaseAdmin'; // ✅ 1. استيراد فايربيز آدمن

export default async function handler(req, res) {
  // السماح فقط بطلبات GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // 🚀 =========================================================
  // 🚀 التحقق من Firebase App Check أولاً قبل أي شيء
  // 🚀 =========================================================
  const appCheckToken = req.headers['x-firebase-appcheck'];

  if (!appCheckToken) {
    console.error('❌ [CheckVersion API] Missing App Check Token');
    return res.status(401).json({ message: 'Unauthorized: Missing App Check token' });
  }

  try {
    // فحص صحة التوكن عبر سيرفرات جوجل
    await admin.appCheck().verifyToken(appCheckToken);
    // console.log('✅ [CheckVersion API] App Check Verified');
  } catch (appCheckError) {
    console.error('❌ [CheckVersion API] App Check Failed:', appCheckError.message);
    return res.status(401).json({ message: 'Unauthorized: Invalid App Check token' });
  }
  // =========================================================

  const { platform } = req.query;

  // التحقق من صحة المنصة
  if (!platform || !['android', 'ios'].includes(platform)) {
    return res.status(400).json({ message: 'Invalid platform. Must be "android" or "ios"' });
  }

  try {
    // جلب البيانات من جدول app_versions
    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .eq('platform', platform)
      .single();

    if (error) {
      // إذا لم يتم العثور على سجل للمنصة
      if (error.code === 'PGRST116') {
         return res.status(404).json({ message: 'Version info not found for this platform' });
      }
      throw error;
    }

    // إرجاع البيانات بنجاح
    return res.status(200).json(data);

  } catch (error) {
    console.error('Check version error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
