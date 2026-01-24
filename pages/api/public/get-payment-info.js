import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { teacherId, courseId, subjectId } = req.query;

  console.log("🚀 [PaymentAPI] Request Received with params:", { teacherId, courseId, subjectId });

  try {
    let targetTeacherId = teacherId;

    // ============================================================
    // 1. إذا كان لدينا Subject ID، نجلب منه Course ID أولاً
    // ============================================================
    if (subjectId && !targetTeacherId) {
        console.log(`🔍 [PaymentAPI] Step 1: Getting Course ID from Subject ID: ${subjectId}`);
        
        const { data: subject, error } = await supabase
            .from('subjects')
            .select('course_id')
            .eq('id', subjectId)
            .maybeSingle(); // نستخدم maybeSingle لتجنب الأخطاء إذا لم يوجد

        if (error) {
            console.error("❌ [PaymentAPI] Subject Lookup Error:", error.message);
        } else if (subject) {
            console.log(`✅ [PaymentAPI] Found Course ID: ${subject.course_id} from Subject.`);
            // نمرر الـ course_id للخطوة التالية
            // (سنقوم بمعالجته في بلوك الـ courseId بالأسفل)
            // لكن هنا سنقوم بجلبه مباشرة لضمان التسلسل
            const { data: courseFromSub } = await supabase
                .from('courses')
                .select('teacher_id')
                .eq('id', subject.course_id)
                .maybeSingle();
            
            if (courseFromSub) {
                targetTeacherId = courseFromSub.teacher_id;
                console.log(`✅ [PaymentAPI] Found Teacher ID: ${targetTeacherId} via Subject chain.`);
            }
        } else {
            console.warn("⚠️ [PaymentAPI] Subject not found.");
        }
    }

    // ============================================================
    // 2. إذا كان لدينا Course ID (ولم نجد المدرس بعد)
    // ============================================================
    if (courseId && !targetTeacherId) {
        console.log(`🔍 [PaymentAPI] Step 2: Getting Teacher ID from Course ID: ${courseId}`);

        const { data: course, error } = await supabase
            .from('courses')
            .select('teacher_id')
            .eq('id', courseId)
            .maybeSingle();
        
        if (error) {
            console.error("❌ [PaymentAPI] Course Lookup Error:", error.message);
        } else if (course) {
            targetTeacherId = course.teacher_id;
            console.log(`✅ [PaymentAPI] Found Teacher ID: ${targetTeacherId} directly from Course.`);
        } else {
            console.warn("⚠️ [PaymentAPI] Course not found.");
        }
    } 

    // ============================================================
    // 3. التحقق النهائي من وجود Teacher ID
    // ============================================================
    if (!targetTeacherId) {
        console.warn("⚠️ [PaymentAPI] Could not resolve a Teacher ID. Returning empty data.");
        return res.status(200).json({
            cash_numbers: [],
            instapay_numbers: [],
            instapay_links: []
        });
    }

    // ============================================================
    // 4. جلب بيانات الدفع من جدول Teachers
    // ============================================================
    console.log(`🔍 [PaymentAPI] Step 3: Fetching payment details for Teacher ID: ${targetTeacherId}`);

    const { data: teacher, error: teacherError } = await supabase
        .from('teachers')
        .select('payment_details')
        .eq('id', targetTeacherId)
        .maybeSingle();

    if (teacherError) {
        console.error("❌ [PaymentAPI] Teacher Lookup Error:", teacherError.message);
    }

    let paymentData = {
        cash_numbers: [],
        instapay_numbers: [],
        instapay_links: []
    };

    const rawDetails = teacher?.payment_details;

    if (rawDetails) {
        console.log("🛠️ [PaymentAPI] Raw Details Found:", JSON.stringify(rawDetails));
        paymentData = {
            cash_numbers: Array.isArray(rawDetails.cash_numbers) ? rawDetails.cash_numbers : [],
            instapay_numbers: Array.isArray(rawDetails.instapay_numbers) ? rawDetails.instapay_numbers : [],
            instapay_links: Array.isArray(rawDetails.instapay_links) ? rawDetails.instapay_links : []
        };
    } else {
        console.log("ℹ️ [PaymentAPI] Teacher found, but has no payment details set.");
    }

    console.log("📤 [PaymentAPI] Sending Final Response.");
    return res.status(200).json(paymentData);

  } catch (err) {
    console.error("🔥 [PaymentAPI] Critical Uncaught Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
