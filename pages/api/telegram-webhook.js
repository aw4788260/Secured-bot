// pages/api/telegram-webhook.js
import axios from 'axios';
import { supabase } from '../../lib/supabaseClient';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// --- الدوال المساعدة ---
const sendMessage = async (chatId, text, reply_markup = null) => {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: text,
    ...(reply_markup && { reply_markup }),
    // تفعيل الماركداون لإظهار الأسماء bold والـ ID كـ code
    parse_mode: 'Markdown' 
  });
};

const answerCallbackQuery = async (callbackQueryId) => {
  await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId,
  });
};

// --- [تم التعديل] ---
// الدالة الآن تقبل (from) لتسجيل/تحديث بيانات المستخدم
const getUser = async (userId, from = null) => {
  const selectQuery = 'id, is_subscribed, is_admin, admin_state, state_data, first_name';
  
  const { data, error } = await supabase
    .from('users')
    .select(selectQuery)
    .eq('id', userId) 
    .single();

  if (error && error.code === 'PGRST116') { // Not found
    const newUser = {
      id: userId,
      is_subscribed: false,
      is_admin: false,
      first_name: from?.first_name,
      last_name: from?.last_name,
      username: from?.username
    };
    const { data: insertedUser } = await supabase
      .from('users')
      .insert(newUser) 
      .select(selectQuery)
      .single();
    return insertedUser;
  }
  
  // إذا كان المستخدم موجوداً ولكن بياناته ناقصة (أو تغيرت)
  if (from && (!data.first_name || data.first_name !== from.first_name)) {
     const { data: updatedUser } = await supabase.from('users').update({
       first_name: from.first_name,
       last_name: from.last_name,
       username: from.username
     }).eq('id', userId).select(selectQuery).single();
     return updatedUser;
  }
  
  return data; // إرجاع المستخدم الموجود
};

const setAdminState = async (userId, state, data = null) => {
  await supabase
    .from('users')
    .update({ admin_state: state, state_data: data })
    .eq('id', userId);
};

// --- دوال الأدمن ---

// 1. القائمة الرئيسية للأدمن
const sendAdminMenu = async (chatId) => {
  const keyboard = {
    inline_keyboard: [
      [{ text: '👤 إدارة المستخدمين', callback_data: 'admin_manage_users' }],
      [{ text: '📚 إدارة المحتوى', callback_data: 'admin_manage_content' }],
    ],
  };
  await sendMessage(chatId, 'Panel Admin:\nاختر القسم:', keyboard);
};

// 2. قائمة إدارة المحتوى
const sendContentMenu = async (chatId) => {
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة كورس', callback_data: 'admin_add_course' }, { text: '➕ إضافة فيديو', callback_data: 'admin_add_video' }],
      [{ text: '❌ حذف كورس', callback_data: 'admin_delete_course' }, { text: '❌ حذف فيديو', callback_data: 'admin_delete_video' }],
      [{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'admin_main_menu' }],
    ],
  };
  await sendMessage(chatId, 'إدارة المحتوى:', keyboard);
};

// 3. قائمة إدارة المستخدمين
const sendUserMenu = async (chatId) => {
   const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة/تحديث مستخدمين', callback_data: 'admin_add_users' }],
      [{ text: '❌ سحب الصلاحيات (محدد/كامل)', callback_data: 'admin_revoke_permissions' }],
      [{ text: '🔄 إعادة تعيين جهاز (حذف البصمة)', callback_data: 'admin_reset_device' }],
      [{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'admin_main_menu' }],
    ],
  };
  await sendMessage(chatId, 'إدارة المستخدمين:', keyboard);
};

// 4. قائمة جلب الكورسات (للاختيار منها)
const fetchAndSendCoursesMenu = async (chatId, text, stateData, callback_prefix) => {
  const { data: courses, error } = await supabase.from('courses').select('id, title').order('title');
  if (error || !courses || courses.length === 0) {
    await sendMessage(chatId, 'خطأ: لم يتم العثور على كورسات. أضف كورسات أولاً.');
    await setAdminState(chatId, null, null);
    return;
  }
  await setAdminState(chatId, 'awaiting_course_selection', stateData);
  const keyboard = courses.map(c => ([{ text: c.title, callback_data: `${callback_prefix}_${c.id}` }]));
  if (callback_prefix === 'assign_course') {
     keyboard.unshift([{ text: '✅ منح صلاحية لكل الكورسات', callback_data: 'assign_all_courses' }]);
     keyboard.push([{ text: '👍 إنهاء ومنح الصلاحيات المحددة', callback_data: 'assign_finish' }]);
  }
  if (callback_prefix === 'select_video_course') {
     keyboard.push([{ text: '🔙 رجوع (إلغاء)', callback_data: 'admin_manage_content' }]);
  }
  await sendMessage(chatId, text, { inline_keyboard: keyboard });
};

// 5. قائمة جلب الفيديوهات (لحذف فيديو)
const fetchAndSendVideosMenu = async (chatId, courseId) => {
  const { data: videos, error } = await supabase.from('videos').select('id, title').eq('course_id', courseId).order('id');
  if (error || !videos || videos.length === 0) {
    await sendMessage(chatId, 'لا توجد فيديوهات في هذا الكورس.');
    await setAdminState(chatId, null, null);
    return;
  }
  await setAdminState(chatId, 'awaiting_video_deletion', { course_id: courseId });
  const keyboard = videos.map(v => ([{ text: v.title, callback_data: `delete_video_confirm_${v.id}` }]));
  keyboard.push([{ text: '🔙 رجوع (إلغاء)', callback_data: 'admin_manage_content' }]);
  await sendMessage(chatId, 'اختر الفيديو الذي تريد حذفه:', { inline_keyboard: keyboard });
};


// --- [تم التعديل] ---
// 6. قائمة سحب الصلاحيات التفاعلية (لإظهار اسم المستخدم)
const sendRevokeMenu = async (adminChatId, targetUserId) => {
  try {
    // جلب بيانات المستخدم (الاسم والاشتراك)
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('first_name, is_subscribed')
      .eq('id', targetUserId)
      .single();

    // (حالة نادرة: المستخدم غير موجود أصلاً)
    if (userError && userError.code === 'PGRST116') {
      await sendMessage(adminChatId, `خطأ: المستخدم \`${targetUserId}\` غير موجود في قاعدة البيانات أصلاً.`);
      return;
    }
    if (userError) throw userError;

    // جلب الكورسات المحددة
    const { data: accessData, error: accessError } = await supabase
      .from('user_course_access')
      .select('course_id')
      .eq('user_id', targetUserId);
    if (accessError) throw accessError;

    let courses = [];
    if (accessData && accessData.length > 0) {
      const courseIds = accessData.map(a => a.course_id);
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .in('id', courseIds);
      if (coursesError) throw coursesError;
      courses = coursesData;
    }

    // بناء الرسالة والأزرار
    let message = `*مراجعة صلاحيات المستخدم:*\n`;
    // [جديد] إضافة الاسم
    message += `👤 *${targetUser.first_name || 'مستخدم غير مسجل الاسم'}* (\`${targetUserId}\`)\n\n`;

    if (targetUser && targetUser.is_subscribed) {
      message += "الحالة: 💎 **مشترك (صلاحية كاملة)**\n";
    } else {
      message += "الحالة: 🔒 **صلاحية محددة**\n";
    }

    if (courses.length > 0) {
      message += "*الكورسات المحددة:*\n";
      courses.forEach(course => {
        message += `- ${course.title}\n`;
        keyboard.push([{
          text: `❌ سحب [${course.title}]`,
          callback_data: `revoke_specific_${targetUserId}_course_${course.id}`
        }]);
      });
    } else {
      message += "لا يمتلك صلاحية لأي كورس محدد.\n";
    }

    keyboard.unshift([{
      text: '⛔️ سحب "جميع" الصلاحيات (الكاملة والمحددة)',
      callback_data: `revoke_all_${targetUserId}`
    }]);
    keyboard.push([{ text: '🔙 رجوع (إلغاء)', callback_data: 'admin_manage_users' }]);

    await sendMessage(adminChatId, message, { inline_keyboard: keyboard });

  } catch (error) {
    await sendMessage(adminChatId, `حدث خطأ أثناء جلب بيانات المستخدم: ${error.message}`);
    await setAdminState(adminChatId, null, null); 
  }
};


// --- الـ Webhook الرئيسي ---
export default async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');

  let user, chatId, userId, text;

  try {
    const { message, callback_query } = req.body;

    if (callback_query) {
      chatId = callback_query.message.chat.id;
      userId = String(callback_query.from.id); // الأدمن
      // [تم التعديل] تحديث بيانات الأدمن (الاسم) إذا لزم الأمر
      user = await getUser(userId, callback_query.from); 
      const command = callback_query.data;
      await answerCallbackQuery(callback_query.id);

      if (!user || !user.is_admin) {
        await sendMessage(chatId, 'أنت لست أدمن.');
        return res.status(200).send('OK');
      }

      // --- 1. معالجة أزرار التنقل الرئيسية ---
      if (command === 'admin_main_menu') {
        await setAdminState(userId, null, null);
        await sendAdminMenu(chatId);
        return res.status(200).send('OK');
      }
      if (command === 'admin_manage_users') {
        await sendUserMenu(chatId);
        return res.status(200).send('OK');
      }
      if (command === 'admin_manage_content') {
        await setAdminState(userId, null, null);
        await sendContentMenu(chatId);
        return res.status(200).send('OK');
      }

      // --- 2. معالجة أزرار "إدارة المستخدمين" ---
      if (command === 'admin_add_users') {
        await setAdminState(userId, 'awaiting_user_ids');
        await sendMessage(chatId, '👤 أرسل الآن ID واحد أو أكثر (افصل بينهم بمسافة أو سطر جديد):');
        return res.status(200).send('OK');
      }
      if (command === 'admin_reset_device') {
        await setAdminState(userId, 'awaiting_device_reset_id');
        await sendMessage(chatId, '👤 أرسل ID المستخدم (أو عدة IDs) الذي تريد حذف بصمته:');
        return res.status(200).send('OK');
      }
      if (command === 'admin_revoke_permissions') {
        await setAdminState(userId, 'awaiting_user_id_for_revoke');
        await sendMessage(chatId, '👤 أرسل "ID المستخدم الواحد" الذي تريد مراجعة صلاحياته:');
        return res.status(200).send('OK');
      }
      
      // "صلاحية كاملة"
      if (command === 'assign_all_courses') {
        const usersToUpdate = user.state_data.users; 
        const userObjects = usersToUpdate.map(id => ({ id: id, is_subscribed: true }));
        const { error } = await supabase.from('users').upsert(userObjects, { onConflict: 'id' });
        if (error) {
           await sendMessage(chatId, `حدث خطأ: ${error.message}`);
        } else {
           await sendMessage(chatId, `✅ تم منح صلاحية كاملة لـ ${usersToUpdate.length} مستخدم.`);
        }
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }
      
      // "صلاحية محددة" (اختيار كورس)
      if (command.startsWith('assign_course_')) {
        const courseId = parseInt(command.split('_')[2], 10); 
        const stateData = user.state_data; 
        const usersToUpdate = stateData.users; 
        
        const userObjects = usersToUpdate.map(id => ({ id: id, is_subscribed: false }));
        const { error: userUpsertError } = await supabase.from('users').upsert(userObjects, { onConflict: 'id' });
        if (userUpsertError) {
          await sendMessage(chatId, `حدث خطأ أثناء تحديث المستخدمين: ${userUpsertError.message}`);
          return res.status(200).send(await setAdminState(userId, null, null));
        }

        const accessObjects = usersToUpdate.map(uid => ({ user_id: uid, course_id: courseId }));
        const { error: accessUpsertError } = await supabase.from('user_course_access').upsert(accessObjects, { onConflict: 'user_id, course_id' });
        if (accessUpsertError) {
           await sendMessage(chatId, `حدث خطأ أثناء إضافة الصلاحية: ${accessUpsertError.message}`);
           return res.status(200).send(await setAdminState(userId, null, null));
        }

        // --- [تم التعديل] ---
        // جلب اسم الكورس لإضافته في الرسالة
        const { data: course } = await supabase.from('courses').select('title').eq('id', courseId).single();
        const courseName = course ? course.title : 'المحدد';

        const finishKeyboard = {
          inline_keyboard: [[{ text: '👍 إنهاء', callback_data: 'assign_finish' }]]
        };
        await sendMessage(
          chatId,
          `✅ تم إضافة صلاحية كورس "*${courseName}*".\n اختر كورساً آخر (من القائمة السابقة) أو اضغط "إنهاء".`,
          finishKeyboard 
        );
        return res.status(200).send('OK');
      }
      
      // "إنهاء" الصلاحيات المحددة
      if (command === 'assign_finish') {
         await sendMessage(chatId, `👍 تم حفظ الصلاحيات المحددة للمستخدمين.`);
         await setAdminState(userId, null, null);
         return res.status(200).send('OK');
      }
      
      // معالجات أزرار سحب الصلاحيات
      if (command.startsWith('revoke_all_')) {
        const targetUserId = command.split('_')[2];
        await supabase.from('user_course_access').delete().eq('user_id', targetUserId);
        await supabase.from('users').update({ is_subscribed: false }).eq('id', targetUserId);
        await sendMessage(chatId, `✅ تم سحب "جميع" الصلاحيات من المستخدم \`${targetUserId}\`.`);
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }
      if (command.startsWith('revoke_specific_')) {
        const parts = command.split('_');
        const targetUserId = parts[2];
        const courseId = parts[4];

        await supabase.from('user_course_access').delete().match({ user_id: targetUserId, course_id: courseId });
        await supabase.from('users').update({ is_subscribed: false }).eq('id', targetUserId);

        await sendMessage(chatId, `✅ تم سحب صلاحية الكورس. جاري تحديث القائمة...`);
        await sendRevokeMenu(chatId, targetUserId); // تحديث القائمة
        return res.status(200).send('OK');
      }
      
      // --- [جديد] ---
      // معالجة زر تنبيه المستخدم الجديد
      if (command.startsWith('admin_grant_access_')) {
        const targetUserId = command.split('_')[3];
        // وضع الأدمن في حالة اختيار الصلاحية لهذا المستخدم
        await setAdminState(userId, 'awaiting_course_selection', { users: [targetUserId] });
        
        await fetchAndSendCoursesMenu(
          chatId, 
          `🔑 منح صلاحيات للمستخدم \`${targetUserId}\`.\nاختر نوع الصلاحية:`,
          { users: [targetUserId] }, // تخزين (string[])
          'assign_course'
        );
        return res.status(200).send('OK');
      }


      // --- (باقي أزرار إدارة المحتوى والحذف كما هي) ---
      if (command === 'admin_add_course') {
        await setAdminState(userId, 'awaiting_course_title');
        await sendMessage(chatId, '📚 أرسل "اسم" الكورس الجديد:');
        return res.status(200).send('OK');
      }
      if (command === 'admin_add_video') {
        await setAdminState(userId, 'awaiting_video_title');
        await sendMessage(chatId, '🚀 أرسل "عنوان" الفيديو:');
        return res.status(200).send('OK');
      }
      if (command.startsWith('add_video_to_course_')) {
        const courseId = parseInt(command.split('_')[4], 10); 
        if (user.admin_state !== 'awaiting_course_selection' || !user.state_data.video || isNaN(courseId)) {
           await sendMessage(chatId, 'حالة غير متوقعة. تم الإلغاء.');
           return res.status(200).send(await setAdminState(userId, null, null));
        }
        const videoData = user.state_data.video; 
        await supabase.from('videos').insert({ ...videoData, course_id: courseId });
        await sendMessage(chatId, '✅✅✅ تم إضافة الفيديو بنجاح!');
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }
      if (command === 'admin_delete_course') {
        await fetchAndSendCoursesMenu(chatId, 'اختر الكورس الذي تريد حذفه:', {}, 'delete_course_confirm');
        return res.status(200).send('OK');
      }
      if (command.startsWith('delete_course_confirm_')) {
        const courseId = parseInt(command.split('_')[3], 10);
        await supabase.from('videos').delete().eq('course_id', courseId);
        await supabase.from('user_course_access').delete().eq('course_id', courseId);
        await supabase.from('courses').delete().eq('id', courseId);
        await sendMessage(chatId, `🗑️ تم حذف الكورس وكل فيديوهاته وصلاحياته بنجاح.`);
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }
      if (command === 'admin_delete_video') {
         await fetchAndSendCoursesMenu(chatId, 'أولاً، اختر "الكورس" الذي يحتوي على الفيديو:', {}, 'select_video_course');
         return res.status(200).send('OK');
      }
      if (command.startsWith('select_video_course_')) {
         const courseId = parseInt(command.split('_')[3], 10);
         await fetchAndSendVideosMenu(chatId, courseId);
         return res.status(200).send('OK');
      }
      if (command.startsWith('delete_video_confirm_')) {
        const videoId = parseInt(command.split('_')[3], 10);
        await supabase.from('videos').delete().eq('id', videoId);
        await sendMessage(chatId, `🗑️ تم حذف الفيديو بنجاح.`);
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }

      return res.status(200).send('OK');
    }

    // --- 3. معالجة الرسائل النصية (لإدخال البيانات) ---
    if (message && message.text && message.from) {
      chatId = message.chat.id;
      userId = String(message.from.id);
      text = message.text;
      // [تم التعديل] تسجيل/تحديث بيانات المستخدم
      user = await getUser(userId, message.from); 

      // أمر /start
      if (text === '/start') {
        if (user && user.is_admin) {
          await sendAdminMenu(chatId);
        } else {
          // التحقق من صلاحيات المستخدم (كاملة أو محددة)
          const { data: accessData } = await supabase
            .from('user_course_access')
            .select('course_id')
            .eq('user_id', userId)
            .limit(1);

          if (user.is_subscribed || (accessData && accessData.length > 0)) {
            // لديه صلاحية (كاملة أو محددة)
            await sendMessage(chatId, 'أهلاً بك! اضغط على زر القائمة في الأسفل لبدء الكورسات.');
          } else {
            // --- [هذا هو التعديل] ---
            // ليس لديه أي صلاحيات (مستخدم جديد)
            await sendMessage(chatId, 'أنت غير مشترك في الخدمة. تم إرسال طلبك إلى الأدمن للمراجعة.');
            
            // إرسال تنبيه لجميع الأدمنز
            const { data: admins } = await supabase.from('users').select('id').eq('is_admin', true);
            if (admins && admins.length > 0) {
              const newUser = message.from;
              let userInfo = `*🔔 مستخدم جديد يحتاج تفعيل:*\n\n`;
              userInfo += `*الاسم:* ${newUser.first_name || ''} ${newUser.last_name || ''}\n`;
              userInfo += `*يوزر:* @${newUser.username || 'N/A'}\n`;
              userInfo += `*ID:* \`${newUser.id}\``;
              
              const keyboard = {
                inline_keyboard: [[
                  { text: `🔑 منح صلاحيات لـ ${newUser.first_name || 'المستخدم'}`, callback_data: `admin_grant_access_${newUser.id}` }
                ]]
              };
              for (const admin of admins) {
                await sendMessage(admin.id, userInfo, keyboard);
              }
            }
          }
        }
        return res.status(200).send('OK');
      }
      
      // أمر /cancel
      if (user && user.is_admin && text === '/cancel') {
         await setAdminState(userId, null, null);
         await sendMessage(chatId, '👍 تم إلغاء العملية.');
         return res.status(200).send('OK');
      }

      // معالجة الحالات (State Machine)
      if (user && user.is_admin && user.admin_state) {
        switch (user.admin_state) {
          
          case 'awaiting_user_ids':
            const ids = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (ids.length === 0) {
              await sendMessage(chatId, 'خطأ. أرسل IDs صالحة. حاول مجدداً أو اضغط /cancel');
              return res.status(200).send('OK');
            }
            await fetchAndSendCoursesMenu(
              chatId, 
              `تم تحديد ${ids.length} مستخدم. اختر نوع الصلاحية:`, 
              { users: ids }, 
              'assign_course'
            );
            break;
          
          case 'awaiting_device_reset_id':
            const resetIds = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (resetIds.length === 0) {
              await sendMessage(chatId, 'خطأ. أرسل IDs صالحة. حاول مجدداً أو اضغط /cancel');
              return res.status(200).send('OK');
            }
            const { error: deleteError } = await supabase
              .from('devices')
              .delete()
              .in('user_id', resetIds); 

            if (deleteError) {
               await sendMessage(chatId, `حدث خطأ: ${deleteError.message}`);
            } else {
               await sendMessage(chatId, `✅ تم حذف البصمات المسجلة لـ ${resetIds.length} مستخدم.`);
            }
            await setAdminState(userId, null, null);
            break;
            
          case 'awaiting_user_id_for_revoke':
            const revokeIds = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (revokeIds.length > 1) {
                 await sendMessage(chatId, 'خطأ. هذه الميزة تعمل لمستخدم واحد فقط في كل مرة. أرسل ID واحد.');
                 return res.status(200).send('OK');
            }
            if (revokeIds.length === 0) {
              await sendMessage(chatId, 'خطأ. أرسل ID صالح. حاول مجدداً أو اضغط /cancel');
              return res.status(200).send('OK');
            }
            const targetUserId = revokeIds[0];
            await setAdminState(userId, null, null); 
            await sendRevokeMenu(chatId, targetUserId); // إظهار القائمة التفاعلية
            break;

          // (باقي الحالات كما هي)
          case 'awaiting_course_title':
            await supabase.from('courses').insert({ title: text });
            await sendMessage(chatId, `✅ تم إضافة الكورس "${text}" بنجاح.`);
            await setAdminState(userId, null, null);
            break;
          case 'awaiting_video_title':
            await setAdminState(userId, 'awaiting_youtube_id', { video: { title: text } });
            await sendMessage(chatId, `👍 العنوان: "${text}"\n\nالآن أرسل "كود يوتيوب":`);
            break;
          case 'awaiting_youtube_id':
            const videoData = user.state_data.video;
            videoData.youtube_id = text;
            await fetchAndSendCoursesMenu(
              chatId,
              '👍 تم حفظ كود اليوتيوب.\n\الآن، اختر الكورس الذي ينتمي إليه هذا الفيديو:',
              { video: videoData }, 
              'add_video_to_course'
            );
            break;
        }
        return res.status(200).send('OK');
      }

      // رسالة عامة
      if (!user.admin_state) {
        await sendMessage(chatId, 'الأمر غير معروف. اضغط /start');
      }
    }

  } catch (e) {
    console.error("Error in webhook:", e.message);
    if (chatId) {
       await sendMessage(chatId, `حدث خطأ جسيم في الخادم: ${e.message}`);
    }
  }
  
  res.status(200).send('OK');
};
