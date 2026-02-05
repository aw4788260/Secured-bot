import SuperLayout from '../../../components/SuperLayout';
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function SuperFinance() {
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(null);
  
  const [financials, setFinancials] = useState({
    total_revenue: 0,
    platform_profit: 0,
    teachers_due: 0,
    teachers_list: []
  });

  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(dateRange).toString();
      const res = await fetch(`/api/dashboard/super/finance?${query}`); 
      
      if (res.ok) {
        const data = await res.json();
        setFinancials(data);
      } else {
        setFinancials({
          total_revenue: 0,
          platform_profit: 0,
          teachers_due: 0,
          teachers_list: []
        });
      }
    } catch (err) {
      console.error("Finance Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [dateRange]);

  // ✅ دالة الطباعة العامة (توليد PDF للقائمة الرئيسية)
  const handleGlobalExportPDF = () => {
    if (financials.teachers_list.length === 0) return;

    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>التقرير المالي العام</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; }
            h1, h2 { text-align: center; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f2f2f2; -webkit-print-color-adjust: exact; }
            .summary-box { display: flex; justify-content: space-around; margin-bottom: 30px; background: #f9f9f9; padding: 15px; border: 1px solid #eee; -webkit-print-color-adjust: exact; }
            .stat { text-align: center; }
            .stat-val { font-weight: bold; font-size: 18px; color: #2563eb; }
          </style>
        </head>
        <body>
          <h1>التقرير المالي الشامل</h1>
          <p style="text-align: center;">الفترة من: ${dateRange.startDate} إلى: ${dateRange.endDate}</p>
          
          <div class="summary-box">
            <div class="stat">إجمالي المبيعات<div class="stat-val">${financials.total_revenue.toLocaleString()} ج.م</div></div>
            <div class="stat">ربح المنصة<div class="stat-val">${financials.platform_profit.toLocaleString()} ج.م</div></div>
            <div class="stat">مستحقات المدرسين<div class="stat-val">${financials.teachers_due.toLocaleString()} ج.م</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>المدرس</th>
                <th>عدد العمليات</th>
                <th>المبيعات</th>
                <th>حصة المنصة</th>
                <th>صافي الربح</th>
              </tr>
            </thead>
            <tbody>
              ${financials.teachers_list.map(t => `
                <tr>
                  <td>${t.name}</td>
                  <td>${t.transaction_count}</td>
                  <td>${t.sales.toLocaleString()}</td>
                  <td>${t.platform_fee.toLocaleString()}</td>
                  <td>${t.net_profit.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // ✅ دالة طباعة تقرير المدرس التفصيلي (تم التعديل لإظهار الألوان والحسابات)
  const handleTeacherReport = async (teacherId) => {
    setReportLoading(teacherId);
    try {
        const query = new URLSearchParams({ 
            teacherId, 
            startDate: dateRange.startDate, 
            endDate: dateRange.endDate 
        }).toString();

        const res = await fetch(`/api/dashboard/super/teacher-report?${query}`);
        if (!res.ok) throw new Error('Failed to fetch report');
        
        const data = await res.json();
        
        // 1. حساب النسب المالية محلياً للعرض
        const totalSales = data.summary.total_approved_amount;
        const platformShare = totalSales * 0.10; // نسبة 10% (يمكن تغييرها إذا كانت ديناميكية)
        const netProfit = totalSales - platformShare;

        // إنشاء نافذة التقرير
        const printWindow = window.open('', '_blank');
        const htmlContent = `
          <html>
            <head>
              <title>تقرير مدرس: ${data.teacherName}</title>
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; }
                h2 { text-align: center; color: #333; margin-bottom: 5px; }
                p.meta { text-align: center; color: #666; margin-top: 0; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                th, td { border: 1px solid #ccc; padding: 6px; text-align: right; }
                th { background-color: #f2f2f2; -webkit-print-color-adjust: exact; }
                
                /* ✅ فرض طباعة الألوان */
                .approved { background-color: #dcfce7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
                .rejected { background-color: #fee2e2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                
                .summary { 
                    margin: 20px 0; 
                    padding: 20px; 
                    border: 1px solid #333; 
                    background-color: #f8fafc;
                    display: flex;
                    justify-content: space-between;
                    -webkit-print-color-adjust: exact;
                }
                .summary-col { flex: 1; }
                .val { font-weight: bold; font-size: 1.1em; }
                .green { color: #16a34a; }
                .blue { color: #2563eb; }
                .red { color: #dc2626; }
              </style>
            </head>
            <body>
              <h2>تقرير تفصيلي للمدرس: ${data.teacherName}</h2>
              <p class="meta">الفترة من ${dateRange.startDate} إلى ${dateRange.endDate}</p>

              <div class="summary">
                <div class="summary-col">
                    <strong>📊 ملخص العمليات:</strong><br/>
                    ✅ عدد المقبول: ${data.summary.total_approved_count}<br/>
                    ❌ عدد المرفوض: ${data.summary.total_rejected_count}
                </div>
                <div class="summary-col" style="border-right: 1px solid #ccc; padding-right: 20px;">
                    <strong>💰 الملخص المالي:</strong><br/>
                    إجمالي المبيعات: <span class="val green">${totalSales.toLocaleString()} ج.م</span><br/>
                    حصة المنصة (10%): <span class="val red">${platformShare.toLocaleString()} ج.م</span><br/>
                    ---------------------------<br/>
                    <strong>صافي المستحق: <span class="val blue">${netProfit.toLocaleString()} ج.م</span></strong>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>اسم الطالب</th>
                    <th>المحتوى</th>
                    <th>المبلغ</th>
                    <th>الحالة</th>
                    <th>ملاحظات / سبب الرفض</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.requests.map(req => `
                    <tr class="${req.status}">
                      <td>${new Date(req.created_at).toLocaleDateString('ar-EG')}</td>
                      <td>${req.user_name || req.user_username}</td>
                      <td>${req.course_title}</td>
                      <td>${req.total_price} ج.م</td>
                      <td>${req.status === 'approved' ? 'مقبول' : 'مرفوض'}</td>
                      <td>${req.rejection_reason || req.user_note || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <script>
                // طباعة تلقائية عند التحميل
                window.onload = function() { window.print(); }
              </script>
            </body>
          </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();

    } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء جلب التقرير');
    } finally {
        setReportLoading(null);
    }
  };

  return (
    <SuperLayout title="التقارير المالية">
      <Head>
        <title>المالية والأرباح | Super Admin</title>
      </Head>

      <div className="finance-container">
        <div className="header-section">
          <div>
            <h1>💰 التقارير المالية</h1>
            <p className="sub-text">متابعة الإيرادات، نسب المنصة، ومستحقات المدرسين</p>
          </div>
          
          <div className="actions-bar">
             <div className="date-picker-group">
                <input 
                  type="date" 
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                  className="date-input"
                />
                <span style={{color:'#94a3b8'}}>إلى</span>
                <input 
                  type="date" 
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                  className="date-input"
                />
             </div>
             <button 
                onClick={handleGlobalExportPDF} 
                className="export-btn"
                disabled={financials.teachers_list.length === 0}
             >
                📄 تصدير PDF
             </button>
          </div>
        </div>

        <div className="cards-grid">
           <div className="stat-card total">
              <div className="icon">💵</div>
              <div className="content">
                 <h3>إجمالي المبيعات</h3>
                 <p>{loading ? '...' : financials.total_revenue.toLocaleString()} ج.م</p>
              </div>
           </div>

           <div className="stat-card profit">
              <div className="icon">📈</div>
              <div className="content">
                 <h3>صافي ربح المنصة</h3>
                 <p>{loading ? '...' : financials.platform_profit.toLocaleString()} ج.م</p>
                 <span className="badge">الدخل الحقيقي</span>
              </div>
           </div>

           <div className="stat-card due">
              <div className="icon">👨‍🏫</div>
              <div className="content">
                 <h3>مستحقات المدرسين</h3>
                 <p>{loading ? '...' : financials.teachers_due.toLocaleString()} ج.م</p>
                 <span className="badge warning">التزام مالي</span>
              </div>
           </div>
        </div>

        <div className="table-container">
           <div className="table-header">
              <h3>تفاصيل المدرسين</h3>
           </div>
           
           {loading ? (
             <div className="loading">
                <div className="spinner"></div>
                <p>جاري حساب الأرقام...</p>
             </div>
           ) : (
             <div className="table-responsive">
               <table>
                 <thead>
                   <tr>
                     <th>اسم المدرس</th>
                     <th>عدد العمليات</th>
                     <th>إجمالي المبيعات</th>
                     <th>نسبة المنصة</th>
                     <th>صافي ربح المدرس</th>
                     <th>الإجراءات</th>
                   </tr>
                 </thead>
                 <tbody>
                   {financials.teachers_list.length > 0 ? (
                     financials.teachers_list.map((teacher) => (
                       <tr key={teacher.id}>
                         <td style={{fontWeight:'bold', color:'white'}}>{teacher.name}</td>
                         <td style={{textAlign:'center'}}>{teacher.transaction_count}</td>
                         <td style={{color:'#4ade80', fontWeight:'bold'}}>{teacher.sales.toLocaleString()} ج.م</td>
                         <td style={{color:'#facc15'}}>{teacher.platform_fee.toLocaleString()} ج.م</td>
                         <td style={{color:'#38bdf8', fontWeight:'bold'}}>{teacher.net_profit.toLocaleString()} ج.م</td>
                         <td>
                            <button 
                                className="btn-details" 
                                onClick={() => handleTeacherReport(teacher.id)}
                                disabled={reportLoading === teacher.id}
                            >
                                {reportLoading === teacher.id ? 'جاري التحميل...' : '📄 تقرير PDF'}
                            </button>
                         </td>
                       </tr>
                     ))
                   ) : (
                     <tr><td colSpan="6" style={{textAlign:'center', padding:'30px', color:'#64748b'}}>لا توجد بيانات في هذه الفترة</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
           )}
        </div>
      </div>

      <style jsx>{`
        .finance-container { padding-bottom: 50px; }
        
        .header-section { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; border-bottom: 1px solid #334155; padding-bottom: 20px; flex-wrap: wrap; gap: 20px; }
        .header-section h1 { margin: 0 0 5px 0; color: #f8fafc; font-size: 1.8rem; }
        .sub-text { color: #94a3b8; margin: 0; }
        
        .actions-bar { display: flex; gap: 15px; align-items: center; }
        .date-picker-group { background: #1e293b; padding: 5px 15px; border-radius: 8px; border: 1px solid #334155; display: flex; gap: 10px; align-items: center; }
        .date-input { background: transparent; border: none; color: white; padding: 8px; outline: none; font-family: inherit; color-scheme: dark; cursor: pointer; }
        
        .export-btn { background: #0f172a; color: #38bdf8; border: 1px solid #38bdf8; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .export-btn:hover:not(:disabled) { background: #38bdf8; color: #0f172a; }
        .export-btn:disabled { opacity: 0.5; cursor: not-allowed; border-color: #475569; color: #64748b; }

        .cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #1e293b; border: 1px solid #334155; padding: 25px; border-radius: 16px; display: flex; gap: 20px; align-items: center; transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-5px); border-color: #475569; }
        
        .stat-card .icon { width: 60px; height: 60px; border-radius: 12px; display: flex; justify-content: center; align-items: center; font-size: 1.8rem; }
        .stat-card.total .icon { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        .stat-card.profit .icon { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
        .stat-card.due .icon { background: rgba(244, 63, 94, 0.1); color: #f43f5e; }

        .stat-card .content h3 { margin: 0 0 5px 0; color: #94a3b8; font-size: 0.9rem; font-weight: normal; }
        .stat-card .content p { margin: 0; font-size: 1.8rem; font-weight: bold; color: white; }
        
        .badge { font-size: 0.75rem; background: #334155; padding: 2px 8px; border-radius: 4px; color: #cbd5e1; margin-top: 5px; display: inline-block; }
        .badge.warning { background: rgba(244, 63, 94, 0.2); color: #fca5a5; }

        .table-container { background: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; }
        .table-header { padding: 20px; border-bottom: 1px solid #334155; background: #0f172a; }
        .table-header h3 { margin: 0; color: white; font-size: 1.1rem; }

        .table-responsive { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: right; padding: 15px 20px; color: #94a3b8; font-size: 0.85rem; background: #1e293b; font-weight: 600; white-space: nowrap; }
        td { padding: 15px 20px; border-top: 1px solid #334155; color: #e2e8f0; vertical-align: middle; white-space: nowrap; }
        tr:hover td { background: rgba(255,255,255,0.02); }

        .btn-details { background: transparent; border: 1px solid #475569; color: #94a3b8; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85em; transition: 0.2s; white-space: nowrap; }
        .btn-details:hover:not(:disabled) { border-color: #38bdf8; color: #38bdf8; }
        .btn-details:disabled { opacity: 0.5; cursor: wait; }

        .loading { text-align: center; padding: 50px; color: #38bdf8; }
        .spinner { width: 30px; height: 30px; border: 3px solid #334155; border-top: 3px solid #38bdf8; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        @media (max-width: 768px) {
            .header-section { flex-direction: column; align-items: flex-start; }
            .actions-bar { width: 100%; flex-direction: column; }
            .date-picker-group { width: 100%; justify-content: space-between; }
            .export-btn { width: 100%; }
        }
      `}</style>
    </SuperLayout>
  );
}
