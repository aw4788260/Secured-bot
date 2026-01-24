import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { teacherId, courseId, subjectId } = req.query;

  // 1. طباعة البيانات القادمة من الطلب
  console.log("🚀 [PaymentAPI] Request Received with params:", { teacherId, courseId, subjectId });

  try {
    // القيمة الافتراضية
    let paymentData = {
        cash_numbers: [],
        instapay_numbers: [],
        instapay_links: []
    };

    let rawDetails = null;

    // ============================================================
    // 1. الحالة الأولى: البحث عن طريق Subject ID
    // ============================================================
    if (subjectId) {
        console.log(`🔍 [PaymentAPI] Searching via Subject ID: ${subjectId}`);
        
        const { data: subject, error } = await supabase
            .from('subjects')
            .select(`
                courses (
                    title,
                    teachers ( id, name, payment_details )
                )
            `)
            .eq('id', subjectId)
            .single();

        if (error) {
            console.error("❌ [PaymentAPI] DB Error (Subject):", error.message);
        } else {
            console.log("📄 [PaymentAPI] Subject Query Result:", JSON.stringify(subject, null, 2));
        }

        // استخراج البيانات من الهيكل المتداخل
        if (subject?.courses?.teachers?.payment_details) {
            console.log("✅ [PaymentAPI] Found payment details via Subject path.");
            rawDetails = subject.courses.teachers.payment_details;
        } else {
            console.warn("⚠️ [PaymentAPI] Subject found, but payment details are missing in the chain.");
        }
    }
    
    // ============================================================
    // 2. الحالة الثانية: البحث عن طريق Course ID
    // ============================================================
    else if (courseId) {
        console.log(`🔍 [PaymentAPI] Searching via Course ID: ${courseId}`);

        const { data: course, error } = await supabase
            .from('courses')
            .select('title, teachers ( id, name, payment_details )')
            .eq('id', courseId)
            .single();
        
        if (error) {
            console.error("❌ [PaymentAPI] DB Error (Course):", error.message);
        } else {
            console.log("📄 [PaymentAPI] Course Query Result:", JSON.stringify(course, null, 2));
        }

        if (course?.teachers?.payment_details) {
            console.log("✅ [PaymentAPI] Found payment details via Course path.");
            rawDetails = course.teachers.payment_details;
        } else {
            console.warn("⚠️ [PaymentAPI] Course found, but payment details are missing.");
        }
    } 
    
    // ============================================================
    // 3. الحالة الثالثة: البحث عن طريق Teacher ID مباشرة
    // ============================================================
    else if (teacherId) {
        console.log(`🔍 [PaymentAPI] Searching via Teacher ID: ${teacherId}`);

        const { data: teacher, error } = await supabase
            .from('teachers')
            .select('name, payment_details')
            .eq('id', teacherId)
            .single();
            
        if (error) {
            console.error("❌ [PaymentAPI] DB Error (Teacher):", error.message);
        } else {
            console.log("📄 [PaymentAPI] Teacher Query Result:", JSON.stringify(teacher, null, 2));
        }

        if (teacher?.payment_details) {
            console.log("✅ [PaymentAPI] Found payment details directly from Teacher.");
            rawDetails = teacher.payment_details;
        } else {
            console.warn("⚠️ [PaymentAPI] Teacher found, but payment_details column is empty/null.");
        }
    } else {
        console.warn("⚠️ [PaymentAPI] No valid ID provided (subjectId, courseId, or teacherId).");
    }

    // ============================================================
    // تنسيق البيانات النهائي
    // ============================================================
    if (rawDetails) {
        console.log("🛠️ [PaymentAPI] Raw Details found:", JSON.stringify(rawDetails));
        paymentData = {
            cash_numbers: Array.isArray(rawDetails.cash_numbers) ? rawDetails.cash_numbers : [],
            instapay_numbers: Array.isArray(rawDetails.instapay_numbers) ? rawDetails.instapay_numbers : [],
            instapay_links: Array.isArray(rawDetails.instapay_links) ? rawDetails.instapay_links : []
        };
    } else {
        console.log("ℹ️ [PaymentAPI] No rawDetails extracted. Returning empty arrays.");
    }

    console.log("📤 [PaymentAPI] Sending Response:", JSON.stringify(paymentData, null, 2));
    return res.status(200).json(paymentData);

  } catch (err) {
    console.error("🔥 [PaymentAPI] Critical Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
