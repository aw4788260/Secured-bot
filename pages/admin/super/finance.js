import SuperLayout from '../../../components/SuperLayout';
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function SuperFinance() {
  const [loading, setLoading] = useState(true);
  const [financials, setFinancials] = useState({
    total_revenue: 0,
    platform_profit: 0,
    teachers_due: 0,
    teachers_list: []
  });

  // فلاتر التاريخ (الافتراضي: آخر 30 يوم)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // جلب البيانات
  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      // بناء رابط الـ API مع الفلاتر
      const query = new URLSearchParams(dateRange).toString();
      const res = await fetch(`/api/admin/super/finance?${query}`);
      
      if (res.ok) {
        const data = await res.json();
        setFinancials(data);
      } else {
        // بيانات وهمية للعرض في حالة عدم جاهزية الـ API
        setFinancials({
          total_revenue: 150000,
          platform_profit: 15000, // مثلاً 10%
          teachers_due: 135000,
          teachers_list: [
            { id: 1, name: 'أ. محمد أحمد', sales: 50000, platform_fee: 5000, net_profit: 45000, transaction_count: 200 },
            { id: 2, name: 'د. سارة علي', sales: 30000, platform_fee: 3000, net_profit: 27000, transaction_count: 120 },
            { id: 3, name: 'أ. محمود حسن', sales: 70000, platform_fee: 7000, net_profit: 63000, transaction_count: 350 },
          ]
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [dateRange]); // إعادة الجلب عند تغيير التاريخ

  // تصدير لـ CSV (محاكاة)
  const handleExportCSV = () => {
    const headers = ['المدرس,المبيعات,نسبة المنصة,صافي الربح,عدد العمليات'];
    const rows = financials.teachers_list.map(t => 
      `${t.name},${t.sales},${t.platform_fee},${t.net_profit},${t.transaction_count}`
    );
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `financial_report_${dateRange.startDate}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <SuperLayout title="التقارير المالية">
      <Head>
        <title>المالية والأرباح | Super Admin</title>
      </Head>

      <div className="finance-container">
        {/* Header Section */}
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
             <button onClick={handleExportCSV} className="export-btn">📄 تصدير CSV</button>
          </div>
        </div>

        {/* Cards Section */}
        <div className="cards-grid">
           <div className="stat-card total">
              <div className="icon">💵</div>
              <div className="content">
                 <h3>إجمالي المبيعات</h3>
                 <p>{financials.total_revenue.toLocaleString()} ج.م</p>
              </div>
           </div>

           <div className="stat-card profit">
              <div className="icon">📈</div>
              <div className="content">
                 <h3>صافي ربح المنصة</h3>
                 <p>{financials.platform_profit.toLocaleString()} ج.م</p>
                 <span className="badge">الدخل الحقيقي</span>
              </div>
           </div>

           <div className="stat-card due">
              <div className="icon">👨‍🏫</div>
              <div className="content">
                 <h3>مستحقات المدرسين</h3>
                 <p>{financials.teachers_due.toLocaleString()} ج.م</p>
                 <span className="badge warning">التزام مالي</span>
              </div>
           </div>
        </div>

        {/* Table Section */}
        <div className="table-container">
           <div className="table-header">
              <h3>تفاصيل المدرسين</h3>
           </div>
           
           {loading ? (
             <div className="loading">جاري حساب الأرقام...</div>
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
                   {financials.teachers_list.map((teacher) => (
                     <tr key={teacher.id}>
                       <td style={{fontWeight:'bold', color:'white'}}>{teacher.name}</td>
                       <td style={{textAlign:'center'}}>{teacher.transaction_count}</td>
                       <td style={{color:'#4ade80', fontWeight:'bold'}}>{teacher.sales.toLocaleString()} ج.م</td>
                       <td style={{color:'#facc15'}}>{teacher.platform_fee.toLocaleString()} ج.م</td>
                       <td style={{color:'#38bdf8', fontWeight:'bold'}}>{teacher.net_profit.toLocaleString()} ج.م</td>
                       <td>
                          <button className="btn-details" onClick={() => alert(`تفاصيل مدرس ${teacher.name} (قريباً)`)}>تفاصيل</button>
                       </td>
                     </tr>
                   ))}
                   {financials.teachers_list.length === 0 && (
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
        .date-input { background: transparent; border: none; color: white; padding: 8px; outline: none; font-family: inherit; color-scheme: dark; }
        
        .export-btn { background: #0f172a; color: #38bdf8; border: 1px solid #38bdf8; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .export-btn:hover { background: #38bdf8; color: #0f172a; }

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
        th { text-align: right; padding: 15px 20px; color: #94a3b8; font-size: 0.85rem; background: #1e293b; font-weight: 600; }
        td { padding: 15px 20px; border-top: 1px solid #334155; color: #e2e8f0; vertical-align: middle; }
        tr:hover td { background: rgba(255,255,255,0.02); }

        .btn-details { background: transparent; border: 1px solid #475569; color: #94a3b8; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85em; transition: 0.2s; }
        .btn-details:hover { border-color: #38bdf8; color: #38bdf8; }

        .loading { text-align: center; padding: 50px; color: #38bdf8; }

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
