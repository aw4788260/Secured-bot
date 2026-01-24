import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { teacherId, courseId, subjectId } = req.query;

  console.log("🚀 [PaymentAPI] Request Received with params:", { teacherId, courseId, subjectId });

  try {
    let targetTeacherId = teacherId;

    // ============================================================
    // 1. المسار السريع: هل تم إرسال Teacher ID مباشرة؟
    // ============================================================
    if (targetTeacherId) {
        console.log(`✅ [PaymentAPI] FAST TRACK: Teacher ID ${targetTeacherId} provided directly. Skipping ID resolution.`);
    } 
    
    // ============================================================
    // 2. مسار البحث (احتياطي فقط): إذا لم يتم إرسال Teacher ID
    // ============================================================
    else {
        // أ) محاولة الاستنتاج من Subject ID
        if (subjectId) {
            console.log(`🔍 [PaymentAPI] Looking up via Subject ID: ${subjectId}`);
            const { data: subject } = await supabase
                .from('subjects')
                .select('course_id')
                .eq('id', subjectId)
                .maybeSingle();

            if (subject && subject.course_id) {
                const { data: course } = await supabase
                    .from('courses')
                    .select('teacher_id')
                    .eq('id', subject.course_id)
                    .maybeSingle();
                if (course) targetTeacherId = course.teacher_id;
            }
        }

        // ب) محاولة الاستنتاج من Course ID
        if (!targetTeacherId && courseId) {
            console.log(`🔍 [PaymentAPI] Looking up via Course ID: ${courseId}`);
            const { data: course } = await supabase
                .from('courses')
                .select('teacher_id')
                .eq('id', courseId)
                .maybeSingle();
            
            if (course) targetTeacherId = course.teacher_id;
        }
    }

    // ============================================================
    // 3. التحقق النهائي
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
    // 4. جلب بيانات الدفع من جدول Teachers مباشرة
    // ============================================================
    console.log(`🔍 [PaymentAPI] Fetching payment details for Teacher ID: ${targetTeacherId}`);

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
        console.log("🛠️ [PaymentAPI] Payment Details Found & Formatted.");
        paymentData = {
            cash_numbers: Array.isArray(rawDetails.cash_numbers) ? rawDetails.cash_numbers : [],
            instapay_numbers: Array.isArray(rawDetails.instapay_numbers) ? rawDetails.instapay_numbers : [],
            instapay_links: Array.isArray(rawDetails.instapay_links) ? rawDetails.instapay_links : []
        };
    } else {
        console.log("ℹ️ [PaymentAPI] Teacher found, but 'payment_details' column is empty.");
    }

    return res.status(200).json(paymentData);

  } catch (err) {
    console.error("🔥 [PaymentAPI] Critical Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
