import { checkUserAccess } from '../../../lib/authHelper';

export default async (req, res) => {
  // نقبل GET أو POST حسب ما يرسله التطبيق
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // في حالة GET نأخذ من query، وفي POST نأخذ من body
  const { contentId, type } = req.method === 'GET' ? req.query : req.body;

  if (!contentId || !type) {
    return res.status(400).json({ valid: false, message: 'Missing parameters (contentId, type)' });
  }

  // 1. استخدام الحارس الأمني
  // نمرر الـ ID والنوع (video, pdf, exam) ليتحقق الحارس من:
  // - صحة التوكن
  // - بصمة الجهاز
  // - امتلاك المستخدم لهذا المحتوى
  const hasAccess = await checkUserAccess(req, contentId, type);

  if (hasAccess) {
    return res.status(200).json({ isSubscribed: true });
  } else {
    // 403 Forbidden تعني أن المستخدم معروف لكنه لا يملك الصلاحية
    return res.status(403).json({ isSubscribed: false, message: 'Access Denied' });
  }
};
