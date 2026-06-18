import SuperLayout from '../../../components/SuperLayout';
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function SuperFinance() {
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(null);
  
  const [financials, setFinancials] = useState({
    total_original_revenue: 0,
    total_actual_revenue: 0,
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
          total_original_revenue: 0,
          total_actual_revenue: 0,
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

  // ✅ دالة الطباعة العامة
  const handleGlobalExportPDF = () => {
    if (financials.teachers_list.length === 0) return;

    // اسم الملف للتقرير العام
    const fileName = `التقرير_المالي_الشامل_${dateRange.startDate}_${dateRange.endDate}`;

    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>${fileName}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; color: #1a1508; }
            .header-container { text-align: center; margin-bottom: 20px; }
            .logo { max-height: 80px; margin-bottom: 10px; }
            h1, h2 { text-align: center; color: #b8903a; margin: 5px 0; }
            p { text-align: center; color: #666; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
            th { background-color: #fbf8f1; color: #b8903a; -webkit-print-color-adjust: exact; font-weight: bold; }
            .summary-box { display: flex; justify-content: space-around; margin-bottom: 30px; background: #faf8f0; padding: 15px; border: 1px solid #e5daba; border-radius: 8px; -webkit-print-color-adjust: exact; }
            .stat { text-align: center; font-weight: bold; color: #333; }
            .stat-val { font-weight: bold; font-size: 18px; color: #b8903a; margin-top: 5px; }
            .stat-val.actual { color: #16a34a; }
            .stat-val.muted { color: #888; font-size: 14px; text-decoration: line-through; }
          </style>
        </head>
        <body>
          <div class="header-container">
             <img src="/logo.png" alt="Logo" class="logo" onerror="this.style.display='none'" />
             <h1>التقرير المالي الشامل</h1>
             <p>الفترة من: ${dateRange.startDate} إلى: ${dateRange.endDate}</p>
          </div>
          
          <div class="summary-box">
            <div class="stat">المبيعات الافتراضية<div class="stat-val muted">${financials.total_original_revenue.toLocaleString()} ج.م</div></div>
            <div class="stat">المبيعات الفعلية (المُحصلة)<div class="stat-val actual">${financials.total_actual_revenue.toLocaleString()} ج.م</div></div>
            <div class="stat">ربح المنصة<div class="stat-val">${financials.platform_profit.toLocaleString()} ج.م</div></div>
            <div class="stat">مستحقات المدرسين<div class="stat-val" style="color: #dc2626">${financials.teachers_due.toLocaleString()} ج.م</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>المدرس</th>
                <th>عدد العمليات</th>
                <th>المبيعات الافتراضية</th>
                <th>المبيعات الفعلية</th>
                <th>حصة المنصة</th>
                <th>صافي الربح للمدرس</th>
              </tr>
            </thead>
            <tbody>
              ${financials.teachers_list.map(t => {
                const hasCustom = t.original_sales !== t.actual_sales;
                return `
                <tr>
                  <td><strong>${t.name}</strong></td>
                  <td>${t.transaction_count}</td>
                  <td style="color:#888; ${hasCustom ? 'text-decoration:line-through;' : ''}">${t.original_sales.toLocaleString()}</td>
                  <td style="color:#16a34a; font-weight:bold;">${t.actual_sales.toLocaleString()}</td>
                  <td>${t.platform_fee.toLocaleString()}</td>
                  <td style="color:#b8903a; font-weight:bold; font-size: 1.1em;">${t.net_profit.toLocaleString()}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #777;">
             تم استخراج هذا التقرير بتاريخ: ${new Date().toLocaleDateString('ar-EG')}
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // ✅ دالة طباعة تقرير المدرس التفصيلي
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
        
        const percentage = data.platformPercentage !== undefined ? data.platformPercentage : 0.10;
        const percentageDisplay = (percentage * 100).toFixed(0).replace(/\.0+$/, '');

        // الحسابات للتقرير (مبنية على الفعلي)
        const totalOriginal = data.summary.total_original_amount || 0;
        const totalActual = data.summary.total_actual_amount || 0;
        const platformShare = totalActual * percentage; 
        const netProfit = totalActual - platformShare;

        const safeName = data.teacherName.replace(/\s+/g, '_');
        const fileName = `تقرير_${safeName}_${dateRange.startDate}_${dateRange.endDate}`;

        const printWindow = window.open('', '_blank');
        const htmlContent = `
          <html>
            <head>
              <title>${fileName}</title> 
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; color: #1a1508; }
                .header-container { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #e5daba; padding-bottom: 20px; }
                .logo { max-height: 80px; margin-bottom: 10px; }
                h2 { text-align: center; color: #333; margin-bottom: 5px; margin-top: 0; }
                p.meta { text-align: center; color: #666; margin-top: 0; font-weight: bold; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                th, td { border: 1px solid #ccc; padding: 10px; text-align: right; vertical-align: middle; }
                th { background-color: #fbf8f1; color: #b8903a; font-weight: bold; -webkit-print-color-adjust: exact; }
                
                .approved { background-color: #f0fdf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
                .rejected { background-color: #fef2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                
                .summary { 
                    margin: 20px 0; 
                    padding: 20px; 
                    border: 1px solid #e5daba; 
                    background-color: #faf8f0;
                    display: flex;
                    justify-content: space-between;
                    -webkit-print-color-adjust: exact;
                    border-radius: 8px;
                }
                .summary-col { flex: 1; text-align: center; }
                .summary-col.border { border-left: 1px solid #e5daba; } 
                
                .val { font-weight: bold; font-size: 1.1em; display: block; margin-top: 5px; }
                .val.muted { color: #888; font-size: 0.9em; text-decoration: line-through; }
                .green { color: #16a34a; }
                .gold { color: #b8903a; }
                .red { color: #dc2626; }
                
                .info-row { margin-bottom: 5px; font-size: 14px; font-weight: bold; color: #444; }
                
                .user-info { font-weight: bold; }
                .username { font-size: 0.85em; color: #777; display: block; }
              </style>
            </head>
            <body>
              <div class="header-container">
                 <img src="/logo.png" alt="Logo" class="logo" onerror="this.style.display='none'" />
                 <h2>تقرير حسابات مدرس</h2>
                 <h3 style="margin:5px 0; color:#b8903a; font-size: 24px;">${data.teacherName}</h3>
                 <p class="meta">الفترة من ${dateRange.startDate} إلى ${dateRange.endDate}</p>
              </div>

              <div class="summary">
                <div class="summary-col border">
                    <div class="info-row">مقبول / مرفوض</div>
                    <span class="val green">${data.summary.total_approved_count} مقبول</span>
                    <span class="val red">${data.summary.total_rejected_count} مرفوض</span>
                </div>
                
                <div class="summary-col border">
                    <div class="info-row">إجمالي المبيعات (الفعلي)</div>
                    <span class="val muted">${totalOriginal.toLocaleString()} ج.م (افتراضي)</span>
                    <span class="val green">${totalActual.toLocaleString()} ج.م</span>
                </div>

                <div class="summary-col border">
                    <div class="info-row">حصة المنصة (${percentageDisplay}%)</div>
                    <span class="val red">${platformShare.toLocaleString()} ج.م</span>
                </div>

                <div class="summary-col">
                    <div class="info-row">صافي المستحق للمدرس</div>
                    <span class="val gold" style="font-size:1.4em">${netProfit.toLocaleString()} ج.م</span>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 80px;">التاريخ</th>
                    <th>الطالب</th>
                    <th>المحتوى</th>
                    <th>السعر المطلوب</th>
                    <th>المدفوع فعلياً</th>
                    <th>الحالة</th>
                    <th>ملاحظة الطالب</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.requests.map(req => {
                     const orig = req.total_price || 0;
                     const act = req.actual_paid_price !== null ? req.actual_paid_price : orig;
                     const hasCustomPrice = req.actual_paid_price !== null;

                     return `
                    <tr class="${req.status}">
                      <td>${new Date(req.created_at).toLocaleDateString('ar-EG')}</td>
                      <td>
                        <span class="user-info">${req.user_name || 'بدون اسم'}</span>
                        <span class="username">${req.user_username ? `(${req.user_username})` : ''}</span>
                      </td>
                      <td>${req.course_title}</td>
                      <td style="${hasCustomPrice ? 'text-decoration:line-through;color:#888;' : ''}">${orig}</td>
                      <td style="font-weight:bold; color:#16a34a;">${act}</td>
                      <td>${req.status === 'approved' ? '✅ مقبول' : '❌ مرفوض'}</td>
                      <td>${req.user_note || '-'}</td>
                    </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
              
              <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #777;">
                تم استخراج هذا التقرير بتاريخ: ${new Date().toLocaleDateString('ar-EG')}
              </div>

              <script>
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

      <div className="finance-luxury-wrapper">
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
                <span className="date-separator">إلى</span>
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
                📄 تصدير PDF (الكل)
             </button>
          </div>
        </div>

        <div className="cards-grid">
           <div className="stat-card default">
              <div className="icon">🏷️</div>
              <div className="content">
                 <h3>المبيعات الافتراضية</h3>
                 <p>{loading ? '...' : financials.total_original_revenue.toLocaleString()} ج.م</p>
                 <span className="badge">سعر الكورسات الأصلي</span>
              </div>
           </div>

           <div className="stat-card total">
              <div className="icon">💵</div>
              <div className="content">
                 <h3>التحصيل الفعلي</h3>
                 <p className="val-success">{loading ? '...' : financials.total_actual_revenue.toLocaleString()} ج.م</p>
                 <span className="badge success">ما تم دفعه فعلياً</span>
              </div>
           </div>

           <div className="stat-card profit">
              <div className="icon gold-icon">📈</div>
              <div className="content">
                 <h3>صافي ربح المنصة</h3>
                 <p className="val-gold">{loading ? '...' : financials.platform_profit.toLocaleString()} ج.م</p>
                 <span className="badge">محسوب من التحصيل الفعلي</span>
              </div>
           </div>

           <div className="stat-card due">
              <div className="icon red-icon">👨‍🏫</div>
              <div className="content">
                 <h3>مستحقات المدرسين</h3>
                 <p className="val-danger">{loading ? '...' : financials.teachers_due.toLocaleString()} ج.م</p>
                 <span className="badge warning">التزام مالي للمدرسين</span>
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
             <div className="table-responsive custom-scrollbar">
                <table>
                  <thead>
                    <tr>
                      <th>اسم المدرس</th>
                      <th style={{textAlign:'center'}}>العمليات</th>
                      <th title="المبلغ الأصلي للكورسات">المبيعات الافتراضية</th>
                      <th title="ما تم دفعه بالفعل وتم حسابه بالتقارير">التحصيل الفعلي</th>
                      <th>نسبة المنصة</th>
                      <th>صافي ربح المدرس</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financials.teachers_list.length > 0 ? (
                      financials.teachers_list.map((teacher) => (
                        <tr key={teacher.id}>
                          <td style={{fontWeight:'bold', color:'var(--text-primary)'}}>{teacher.name}</td>
                          <td style={{textAlign:'center', color: 'var(--text-secondary)'}}>{teacher.transaction_count}</td>
                          <td style={{
                              color:'var(--text-muted)', 
                              textDecoration: teacher.original_sales !== teacher.actual_sales ? 'line-through' : 'none'
                          }}>
                              {teacher.original_sales.toLocaleString()}
                          </td>
                          <td style={{color:'#4ade80', fontWeight:'bold'}}>{teacher.actual_sales.toLocaleString()} ج.م</td>
                          <td style={{color:'var(--text-secondary)'}}>{teacher.platform_fee.toLocaleString()}</td>
                          <td style={{color:'var(--gold)', fontWeight:'bold', fontSize: '1.05em'}}>{teacher.net_profit.toLocaleString()} ج.م</td>
                          <td>
                             <button 
                                 className="btn-details" 
                                 onClick={() => handleTeacherReport(teacher.id)}
                                 disabled={reportLoading === teacher.id}
                             >
                                 {reportLoading === teacher.id ? 'جاري التحميل...' : '📄 كشف حساب PDF'}
                             </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="7" style={{textAlign:'center', padding:'40px', color:'var(--text-muted)'}}>لا توجد بيانات مالية مسجلة في هذه الفترة</td></tr>
                    )}
                  </tbody>
                </table>
             </div>
           )}
        </div>
      </div>

      <style jsx>{`
        .finance-luxury-wrapper { 
            padding-bottom: 50px; 
            color: var(--text-primary);
        }
        
        .header-section { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; border-bottom: 1px solid var(--border); padding-bottom: 20px; flex-wrap: wrap; gap: 20px; }
        .header-section h1 { margin: 0 0 5px 0; color: var(--text-primary); font-size: 1.8rem; font-weight: 800; }
        .sub-text { color: var(--text-secondary); margin: 0; }
        
        .actions-bar { display: flex; gap: 15px; align-items: center; }
        .date-picker-group { background: var(--bg-surface); padding: 5px 15px; border-radius: 8px; border: 1px solid var(--border); display: flex; gap: 10px; align-items: center; }
        .date-separator { color: var(--text-muted); font-weight: bold; }
        .date-input { background: transparent; border: none; color: var(--text-primary); padding: 8px; outline: none; font-family: inherit; color-scheme: dark; cursor: pointer; font-weight: bold; }
        
        .export-btn { background: var(--bg-elevated); color: var(--gold); border: 1px solid var(--gold); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.3s ease; display: flex; align-items: center; gap: 8px; }
        .export-btn:hover:not(:disabled) { background: var(--gold); color: #111009; box-shadow: 0 4px 12px var(--gold-dim); transform: translateY(-2px); }
        .export-btn:disabled { opacity: 0.4; cursor: not-allowed; border-color: var(--border-accent); color: var(--text-muted); }

        .cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: var(--bg-surface); border: 1px solid var(--border); padding: 20px; border-radius: 16px; display: flex; gap: 15px; align-items: center; transition: transform 0.2s, box-shadow 0.2s; }
        .stat-card:hover { transform: translateY(-5px); border-color: var(--border-accent); box-shadow: var(--shadow); }
        
        .stat-card .icon { width: 50px; height: 50px; border-radius: 12px; display: flex; justify-content: center; align-items: center; font-size: 1.5rem; flex-shrink: 0; background: var(--bg-elevated); border: 1px solid var(--border); }
        .default .icon { color: var(--text-secondary); }
        .total .icon { background: rgba(34, 197, 94, 0.1); color: #4ade80; border-color: rgba(34, 197, 94, 0.2); }
        .profit .icon.gold-icon { background: var(--gold-dimmer); color: var(--gold); border-color: var(--border-accent); }
        .due .icon.red-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.2); }

        .stat-card .content h3 { margin: 0 0 5px 0; color: var(--text-secondary); font-size: 0.85rem; font-weight: bold; }
        .stat-card .content p { margin: 0; font-size: 1.5rem; font-weight: 800; color: var(--text-primary); }
        .val-success { color: #4ade80 !important; }
        .val-gold { color: var(--gold) !important; }
        .val-danger { color: #ef4444 !important; }
        
        .badge { font-size: 0.7rem; background: var(--bg-elevated); padding: 4px 8px; border-radius: 4px; color: var(--text-muted); margin-top: 8px; display: inline-block; border: 1px solid var(--border); font-weight: bold; }
        .badge.warning { background: rgba(239, 68, 68, 0.1); color: #f87171; border-color: rgba(239, 68, 68, 0.2); }
        .badge.success { background: rgba(34, 197, 94, 0.1); color: #4ade80; border-color: rgba(34, 197, 94, 0.2); }

        .table-container { background: var(--bg-surface); border-radius: 16px; border: 1px solid var(--border); overflow: hidden; box-shadow: var(--shadow); }
        .table-header { padding: 20px; border-bottom: 1px solid var(--border); background: var(--bg-elevated); }
        .table-header h3 { margin: 0; color: var(--text-primary); font-size: 1.2rem; font-weight: bold; }

        .table-responsive { overflow-x: auto; }
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: var(--bg-base); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-accent); border-radius: 4px; }

        table { width: 100%; border-collapse: collapse; }
        th { text-align: right; padding: 15px 20px; color: var(--text-muted); font-size: 0.85rem; background: var(--bg-elevated); font-weight: bold; white-space: nowrap; text-transform: uppercase; border-bottom: 1px solid var(--border); }
        td { padding: 15px 20px; border-bottom: 1px solid var(--border); color: var(--text-secondary); vertical-align: middle; white-space: nowrap; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: var(--bg-hover); }

        .btn-details { background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text-secondary); padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85em; transition: 0.2s; white-space: nowrap; font-weight: bold; }
        .btn-details:hover:not(:disabled) { border-color: var(--gold); color: var(--gold); background: var(--gold-dimmer); transform: translateY(-1px); }
        .btn-details:disabled { opacity: 0.5; cursor: wait; }

        .loading { text-align: center; padding: 50px; color: var(--gold); }
        .spinner { width: 35px; height: 35px; border: 3px solid var(--border); border-top: 3px solid var(--gold); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        @media (max-width: 768px) {
            .header-section { flex-direction: column; align-items: flex-start; }
            .actions-bar { width: 100%; flex-direction: column; align-items: stretch; }
            .date-picker-group { width: 100%; justify-content: space-between; }
            .export-btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </SuperLayout>
  );
}
