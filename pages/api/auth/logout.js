import { serialize } from 'cookie';

export default async (req, res) => {
  // إرسال كوكي منتهي الصلاحية لمسحه من المتصفح
  const cookie = serialize('admin_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    expires: new Date(0), // تاريخ قديم للحذف فوراً
    sameSite: 'strict',
    path: '/'
  });

  res.setHeader('Set-Cookie', cookie);
  res.status(200).json({ success: true });
};
