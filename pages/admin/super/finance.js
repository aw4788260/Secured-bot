import { useState, useEffect } from 'react';
import Head from 'next/head';
import SuperLayout from '../../../components/SuperLayout';

// ─── SVG Icons ──────────────────────────────────────────
const WalletIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path></svg>);
const TagIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>);
const CashIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path></svg>);
const ChartIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>);
const TeacherIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>);
const FileTextIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>);

// ─── Shared Report CSS ──────────────────────────────────
const getReportCSS = () => `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
    background: #fdfbf5;
    color: #1a1508;
    direction: rtl;
    padding: 0;
    min-height: 100vh;
  }

  /* ── PAGE WRAPPER ── */
  .report-page {
    max-width: 1050px;
    margin: 0 auto;
    background: #ffffff;
    min-height: 100vh;
  }

  /* ── HEADER BANNER ── */
  .report-header {
    background: linear-gradient(135deg, #1a1508 0%, #2c2312 50%, #1a1508 100%);
    padding: 36px 48px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    position: relative;
    overflow: hidden;
  }
  .report-header::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 30% 50%, rgba(201,168,76,0.12) 0%, transparent 60%);
    pointer-events: none;
  }
  .report-header::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, #c9a84c, #e8c96a, #c9a84c, transparent);
  }

  .header-logo-wrap {
    flex-shrink: 0;
  }
  .header-logo-wrap img {
    height: 70px;
    width: auto;
    object-fit: contain;
    filter: brightness(1.1);
  }

  .header-title-block {
    text-align: center;
    flex: 1;
  }
  .header-title-block .report-type-label {
    display: inline-block;
    background: rgba(201,168,76,0.2);
    border: 1px solid rgba(201,168,76,0.4);
    color: #e8c96a;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    padding: 4px 14px;
    border-radius: 20px;
    margin-bottom: 10px;
    text-transform: uppercase;
  }
  .header-title-block h1 {
    color: #f5f0e0;
    font-size: 1.9rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 1.2;
    margin-bottom: 8px;
  }
  .header-title-block h1 span {
    color: #c9a84c;
  }
  .header-title-block .date-range-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(201,168,76,0.25);
    padding: 6px 16px;
    border-radius: 30px;
    color: #a89f7a;
    font-size: 0.88rem;
    font-weight: 600;
  }
  .header-title-block .date-range-pill .dot {
    width: 6px; height: 6px;
    background: #c9a84c;
    border-radius: 50%;
    display: inline-block;
  }

  .header-meta-block {
    text-align: left;
    flex-shrink: 0;
  }
  .header-meta-block .meta-item {
    font-size: 0.78rem;
    color: #a89f7a;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .header-meta-block .meta-item span {
    color: #c9a84c;
    margin-right: 4px;
  }

  /* ── SUMMARY STRIP ── */
  .summary-strip {
    background: #faf8f0;
    border-bottom: 1px solid #e8dfc0;
    padding: 24px 48px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
  }
  .summary-cell {
    text-align: center;
    padding: 8px 16px;
    border-left: 1px solid #e8dfc0;
  }
  .summary-cell:last-child {
    border-left: none;
  }
  .summary-cell .cell-label {
    font-size: 0.78rem;
    color: #9e8850;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .summary-cell .cell-value {
    font-size: 1.35rem;
    font-weight: 900;
    display: block;
    line-height: 1;
    margin-bottom: 4px;
  }
  .summary-cell .cell-value.gold { color: #b8903a; }
  .summary-cell .cell-value.green { color: #16a34a; }
  .summary-cell .cell-value.red { color: #dc2626; }
  .summary-cell .cell-value.muted { color: #9e8850; font-size: 1rem; text-decoration: line-through; }
  .summary-cell .cell-currency {
    font-size: 0.75rem;
    color: #9e8850;
    font-weight: 600;
  }

  /* ── SECTION TITLE ── */
  .section-title {
    padding: 20px 48px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .section-title h2 {
    font-size: 1rem;
    font-weight: 800;
    color: #b8903a;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .section-title .title-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, #e8dfc0, transparent);
  }

  /* ── TABLE ── */
  .report-table-wrap {
    padding: 0 48px 32px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
  }
  thead tr {
    background: linear-gradient(90deg, #1a1508 0%, #2c2312 100%);
  }
  thead th {
    color: #c9a84c;
    font-weight: 800;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding: 14px 16px;
    text-align: right;
    white-space: nowrap;
    border: none;
  }
  tbody tr {
    border-bottom: 1px solid #f0ead6;
    transition: background 0.15s;
  }
  tbody tr:nth-child(even) {
    background: #fdfbf5;
  }
  tbody tr:last-child {
    border-bottom: none;
  }
  tbody td {
    padding: 13px 16px;
    text-align: right;
    color: #3a3015;
    vertical-align: middle;
  }
  tbody td.td-name { font-weight: 800; color: #1a1508; font-size: 0.95rem; }
  tbody td.td-count { text-align: center; }
  .count-chip {
    display: inline-block;
    background: #f0ead6;
    border: 1px solid #e8dfc0;
    color: #6b5a2a;
    padding: 3px 12px;
    border-radius: 20px;
    font-weight: 700;
    font-size: 0.82rem;
  }
  .td-original { color: #9e8850; text-decoration: line-through; }
  .td-actual { color: #16a34a; font-weight: 800; font-size: 0.95rem; }
  .td-fee { color: #6b5a2a; }
  .td-profit { color: #b8903a; font-weight: 900; font-size: 1rem; }

  /* Status badges */
  .badge-approved { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 3px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; display: inline-block; }
  .badge-rejected { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 3px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; display: inline-block; }

  /* ── TEACHER REPORT SUMMARY ── */
  .teacher-summary-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    padding: 0 48px 24px;
  }
  .teacher-summary-card {
    background: #faf8f0;
    border: 1px solid #e8dfc0;
    border-radius: 12px;
    padding: 20px 24px;
    text-align: center;
  }
  .teacher-summary-card.highlight {
    background: linear-gradient(135deg, #1a1508, #2c2312);
    border-color: #5a4e28;
  }
  .teacher-summary-card .card-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #9e8850;
    margin-bottom: 10px;
  }
  .teacher-summary-card.highlight .card-label { color: #a89f7a; }
  .teacher-summary-card .card-value {
    font-size: 1.5rem;
    font-weight: 900;
    display: block;
    line-height: 1.1;
  }
  .teacher-summary-card .card-value.gold { color: #b8903a; }
  .teacher-summary-card.highlight .card-value { color: #e8c96a; }
  .teacher-summary-card .card-value.green { color: #16a34a; }
  .teacher-summary-card .card-value.red { color: #dc2626; }
  .teacher-summary-card .card-sub {
    font-size: 0.78rem;
    color: #9e8850;
    margin-top: 6px;
    font-weight: 600;
  }
  .teacher-summary-card.highlight .card-sub { color: #a89f7a; }

  /* ── TEACHER NAME BLOCK ── */
  .teacher-name-block {
    text-align: center;
    padding: 20px 48px 12px;
  }
  .teacher-name-block .teacher-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: #faf8f0;
    border: 2px solid #c9a84c;
    border-radius: 40px;
    padding: 8px 24px;
  }
  .teacher-name-block .teacher-avatar {
    width: 36px; height: 36px;
    background: linear-gradient(135deg, #c9a84c, #e8c96a);
    color: #1a1508;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.1rem; font-weight: 900;
    flex-shrink: 0;
  }
  .teacher-name-block .teacher-name-text {
    font-size: 1.25rem;
    font-weight: 900;
    color: #1a1508;
  }

  /* ── FOOTER ── */
  .report-footer {
    margin: 0 48px;
    padding: 16px 0;
    border-top: 1px solid #e8dfc0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .report-footer .footer-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #9e8850;
    font-size: 0.8rem;
    font-weight: 700;
  }
  .report-footer .footer-brand .brand-dot {
    width: 8px; height: 8px;
    background: linear-gradient(135deg, #c9a84c, #e8c96a);
    border-radius: 50%;
    display: inline-block;
  }
  .report-footer .footer-timestamp {
    color: #b8a878;
    font-size: 0.78rem;
    font-weight: 600;
  }

  /* ── PRINT ── */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .summary-strip { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tbody tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .teacher-summary-card.highlight { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .badge-approved, .badge-rejected { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

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

  // ─── Helper: get absolute logo URL ───────────────────
  const getLogoUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/medaad-logo.png`;
    }
    return '/medaad-logo.png';
  };

  // ─── Helper: format date in Arabic ───────────────────
  const formatDateAr = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // ─── Global Finance Report PDF ────────────────────────
  const handleGlobalExportPDF = () => {
    if (financials.teachers_list.length === 0) return;

    const now = new Date();
    const printWindow = window.open('', '_blank');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <title>التقرير المالي الشامل - مداد</title>
          <style>${getReportCSS()}</style>
        </head>
        <body>
          <div class="report-page">

            <!-- HEADER -->
            <div class="report-header">
              <div class="header-logo-wrap">
                <img src="${getLogoUrl()}" alt="مداد" onerror="this.style.display='none'" />
              </div>

              <div class="header-title-block">
                <div class="report-type-label">التقارير المالية</div>
                <h1>التقرير المالي <span>الشامل</span></h1>
                <div class="date-range-pill">
                  <span class="dot"></span>
                  ${formatDateAr(dateRange.startDate)}
                  &nbsp;—&nbsp;
                  ${formatDateAr(dateRange.endDate)}
                  <span class="dot"></span>
                </div>
              </div>

              <div class="header-meta-block">
                <div class="meta-item">عدد المدرسين: <span>${financials.teachers_list.length}</span></div>
                <div class="meta-item">تاريخ الإصدار: <span>${now.toLocaleDateString('ar-EG')}</span></div>
                <div class="meta-item">الوقت: <span>${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span></div>
              </div>
            </div>

            <!-- SUMMARY STRIP -->
            <div class="summary-strip">
              <div class="summary-cell">
                <div class="cell-label">المبيعات الافتراضية</div>
                <span class="cell-value muted">${financials.total_original_revenue.toLocaleString('ar-EG')}</span>
                <div class="cell-currency">جنيه مصري</div>
              </div>
              <div class="summary-cell">
                <div class="cell-label">التحصيل الفعلي</div>
                <span class="cell-value green">${financials.total_actual_revenue.toLocaleString('ar-EG')}</span>
                <div class="cell-currency">جنيه مصري</div>
              </div>
              <div class="summary-cell">
                <div class="cell-label">صافي ربح المنصة</div>
                <span class="cell-value gold">${financials.platform_profit.toLocaleString('ar-EG')}</span>
                <div class="cell-currency">جنيه مصري</div>
              </div>
              <div class="summary-cell">
                <div class="cell-label">مستحقات المدرسين</div>
                <span class="cell-value red">${financials.teachers_due.toLocaleString('ar-EG')}</span>
                <div class="cell-currency">جنيه مصري</div>
              </div>
            </div>

            <!-- TABLE SECTION -->
            <div class="section-title">
              <h2>تفاصيل المدرسين الماليـة</h2>
              <div class="title-line"></div>
            </div>

            <div class="report-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>اسم المدرس</th>
                    <th style="text-align:center">العمليات</th>
                    <th>المبيعات الافتراضية</th>
                    <th>التحصيل الفعلي</th>
                    <th>حصة المنصة</th>
                    <th>صافي الربح</th>
                  </tr>
                </thead>
                <tbody>
                  ${financials.teachers_list.map((t, i) => {
                    const hasCustom = t.original_sales !== t.actual_sales;
                    return `
                    <tr>
                      <td style="color:#9e8850; font-weight:700; font-size:0.8rem;">${i + 1}</td>
                      <td class="td-name">${t.name}</td>
                      <td class="td-count"><span class="count-chip">${t.transaction_count}</span></td>
                      <td class="${hasCustom ? 'td-original' : ''}">${t.original_sales.toLocaleString('ar-EG')} ج.م</td>
                      <td class="td-actual">${t.actual_sales.toLocaleString('ar-EG')} ج.م</td>
                      <td class="td-fee">${t.platform_fee.toLocaleString('ar-EG')} ج.م</td>
                      <td class="td-profit">${t.net_profit.toLocaleString('ar-EG')} ج.م</td>
                    </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- FOOTER -->
            <div class="report-footer">
              <div class="footer-brand">
                <span class="brand-dot"></span>
                منصة مداد التعليمية — وثيقة مالية رسمية
              </div>
              <div class="footer-timestamp">
                صدر بتاريخ ${now.toLocaleDateString('ar-EG')} الساعة ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 400);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // ─── Teacher Detailed Report PDF ─────────────────────
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
      const totalOriginal = data.summary.total_original_amount || 0;
      const totalActual = data.summary.total_actual_amount || 0;
      const platformShare = totalActual * percentage;
      const netProfit = totalActual - platformShare;
      const now = new Date();

      const printWindow = window.open('', '_blank');
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8" />
            <title>كشف حساب — ${data.teacherName} | مداد</title>
            <style>${getReportCSS()}</style>
          </head>
          <body>
            <div class="report-page">

              <!-- HEADER -->
              <div class="report-header">
                <div class="header-logo-wrap">
                  <img src="${getLogoUrl()}" alt="مداد" onerror="this.style.display='none'" />
                </div>

                <div class="header-title-block">
                  <div class="report-type-label">كشف حساب مدرس</div>
                  <h1>تقرير <span>حسابات المدرس</span></h1>
                  <div class="date-range-pill">
                    <span class="dot"></span>
                    ${formatDateAr(dateRange.startDate)}
                    &nbsp;—&nbsp;
                    ${formatDateAr(dateRange.endDate)}
                    <span class="dot"></span>
                  </div>
                </div>

                <div class="header-meta-block">
                  <div class="meta-item">نسبة المنصة: <span>${percentageDisplay}%</span></div>
                  <div class="meta-item">إجمالي العمليات: <span>${data.requests.length}</span></div>
                  <div class="meta-item">تاريخ الإصدار: <span>${now.toLocaleDateString('ar-EG')}</span></div>
                </div>
              </div>

              <!-- TEACHER NAME -->
              <div class="teacher-name-block" style="padding:24px 48px 16px;">
                <div class="teacher-badge">
                  <div class="teacher-avatar">${data.teacherName.charAt(0)}</div>
                  <span class="teacher-name-text">${data.teacherName}</span>
                </div>
              </div>

              <!-- SUMMARY CARDS -->
              <div class="teacher-summary-grid">
                <div class="teacher-summary-card">
                  <div class="card-label">حالة الطلبات</div>
                  <span class="card-value green">${data.summary.total_approved_count} مقبول</span>
                  <span class="card-value red" style="font-size:1rem; margin-top:6px;">${data.summary.total_rejected_count} مرفوض</span>
                </div>

                <div class="teacher-summary-card">
                  <div class="card-label">إجمالي المبيعات</div>
                  <span class="card-value" style="color:#9e8850; text-decoration:line-through; font-size:0.95rem;">${totalOriginal.toLocaleString('ar-EG')} ج.م (افتراضي)</span>
                  <span class="card-value green" style="margin-top:8px;">${totalActual.toLocaleString('ar-EG')} ج.م</span>
                  <div class="card-sub">التحصيل الفعلي</div>
                </div>

                <div class="teacher-summary-card">
                  <div class="card-label">حصة المنصة (${percentageDisplay}%)</div>
                  <span class="card-value red">${platformShare.toLocaleString('ar-EG')} ج.م</span>
                  <div class="card-sub">محسوبة من التحصيل الفعلي</div>
                </div>

                <div class="teacher-summary-card highlight">
                  <div class="card-label">صافي المستحق للمدرس</div>
                  <span class="card-value">${netProfit.toLocaleString('ar-EG')} ج.م</span>
                  <div class="card-sub">بعد خصم حصة المنصة</div>
                </div>
              </div>

              <!-- TABLE SECTION -->
              <div class="section-title">
                <h2>تفاصيل الطلبات والمعاملات</h2>
                <div class="title-line"></div>
              </div>

              <div class="report-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>التاريخ</th>
                      <th>الطالب</th>
                      <th>المحتوى</th>
                      <th>السعر المطلوب</th>
                      <th>المدفوع فعلياً</th>
                      <th>الحالة</th>
                      <th>ملاحظة</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.requests.map((req, i) => {
                      const orig = req.total_price || 0;
                      const act = req.actual_paid_price !== null ? req.actual_paid_price : orig;
                      const hasCustomPrice = req.actual_paid_price !== null;
                      const isApproved = req.status === 'approved';
                      return `
                      <tr>
                        <td style="color:#9e8850; font-weight:700; font-size:0.8rem;">${i + 1}</td>
                        <td style="white-space:nowrap; color:#6b5a2a; font-weight:600; font-size:0.82rem;">
                          ${new Date(req.created_at).toLocaleDateString('ar-EG')}
                        </td>
                        <td>
                          <div style="font-weight:800; color:#1a1508;">${req.user_name || 'بدون اسم'}</div>
                          ${req.user_username ? `<div style="font-size:0.78rem; color:#9e8850;">(${req.user_username})</div>` : ''}
                        </td>
                        <td style="font-weight:600; color:#3a3015; max-width:160px; word-break:break-word;">${req.course_title}</td>
                        <td style="${hasCustomPrice ? 'color:#9e8850; text-decoration:line-through;' : 'color:#3a3015; font-weight:700;'}">${orig.toLocaleString('ar-EG')}</td>
                        <td class="td-actual">${act.toLocaleString('ar-EG')} ج.م</td>
                        <td>
                          <span class="${isApproved ? 'badge-approved' : 'badge-rejected'}">
                            ${isApproved ? '✓ مقبول' : '✗ مرفوض'}
                          </span>
                        </td>
                        <td style="color:#9e8850; font-size:0.82rem; max-width:120px; word-break:break-word;">${req.user_note || '—'}</td>
                      </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              <!-- FOOTER -->
              <div class="report-footer">
                <div class="footer-brand">
                  <span class="brand-dot"></span>
                  منصة مداد التعليمية — وثيقة مالية رسمية
                </div>
                <div class="footer-timestamp">
                  صدر بتاريخ ${now.toLocaleDateString('ar-EG')} الساعة ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

            </div>
            <script>
              window.onload = function() {
                setTimeout(function() { window.print(); }, 400);
              }
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
        <title>المالية والأرباح | الإدارة العليا</title>
      </Head>

      <div className="finance-luxury-wrapper">
        
        {/* Header Section */}
        <div className="page-header">
          <div className="header-title-wrap">
            <div className="header-icon"><WalletIcon /></div>
            <div>
              <h1>التقارير المالية والأرباح</h1>
              <p>متابعة الإيرادات، نسب المنصة، ومستحقات المدرسين</p>
            </div>
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
                <FileTextIcon /> تصدير PDF للكل
             </button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="cards-grid">
           <div className="stat-card default">
              <div className="icon"><TagIcon /></div>
              <div className="content">
                 <h3>المبيعات الافتراضية</h3>
                 <p>{loading ? '...' : financials.total_original_revenue.toLocaleString()} <span style={{fontSize:'1rem'}}>ج.م</span></p>
                 <span className="badge">سعر الكورسات الأصلي</span>
              </div>
           </div>

           <div className="stat-card total">
              <div className="icon"><CashIcon /></div>
              <div className="content">
                 <h3>التحصيل الفعلي</h3>
                 <p className="val-success">{loading ? '...' : financials.total_actual_revenue.toLocaleString()} <span style={{fontSize:'1rem'}}>ج.م</span></p>
                 <span className="badge success">ما تم دفعه فعلياً</span>
              </div>
           </div>

           <div className="stat-card profit">
              <div className="icon gold-icon"><ChartIcon /></div>
              <div className="content">
                 <h3>صافي ربح المنصة</h3>
                 <p className="val-gold">{loading ? '...' : financials.platform_profit.toLocaleString()} <span style={{fontSize:'1rem'}}>ج.م</span></p>
                 <span className="badge">محسوب من التحصيل الفعلي</span>
              </div>
           </div>

           <div className="stat-card due">
              <div className="icon red-icon"><TeacherIcon /></div>
              <div className="content">
                 <h3>مستحقات المدرسين</h3>
                 <p className="val-danger">{loading ? '...' : financials.teachers_due.toLocaleString()} <span style={{fontSize:'1rem'}}>ج.م</span></p>
                 <span className="badge warning">التزام مالي للمدرسين</span>
              </div>
           </div>
        </div>

        {/* Main Table */}
        <div className="table-container">
           <div className="table-header">
             <h3>تفاصيل المدرسين الماليـة</h3>
           </div>
           
           {loading ? (
             <div className="loading-wrap">
                <div className="spinner"></div>
                <p>جاري حساب الأرقام وبناء التقرير...</p>
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
                          <td style={{fontWeight:'700', color:'var(--text-primary)'}}>{teacher.name}</td>
                          <td style={{textAlign:'center', color: 'var(--text-secondary)'}}>
                            <span className="count-badge">{teacher.transaction_count}</span>
                          </td>
                          <td style={{
                              color:'var(--text-muted)', 
                              textDecoration: teacher.original_sales !== teacher.actual_sales ? 'line-through' : 'none'
                          }}>
                              {teacher.original_sales.toLocaleString()}
                          </td>
                          <td style={{color:'#4ade80', fontWeight:'700'}}>{teacher.actual_sales.toLocaleString()} ج.م</td>
                          <td style={{color:'var(--text-secondary)'}}>{teacher.platform_fee.toLocaleString()}</td>
                          <td style={{color:'var(--gold)', fontWeight:'800', fontSize: '1.05rem'}}>{teacher.net_profit.toLocaleString()} ج.م</td>
                          <td>
                             <button 
                                 className="btn-details" 
                                 onClick={() => handleTeacherReport(teacher.id)}
                                 disabled={reportLoading === teacher.id}
                             >
                                 {reportLoading === teacher.id ? <span className="small-spinner"></span> : <><FileTextIcon /> كشف حساب PDF</>}
                             </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="7" className="empty-state">لا توجد بيانات مالية مسجلة في هذه الفترة المحددة</td></tr>
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
            max-width: 100%;
        }
        
        /* ── HEADERS ── */
        .page-header { 
          display: flex; justify-content: space-between; align-items: flex-end; 
          margin-bottom: 30px; 
          border-bottom: 1px solid var(--border); 
          padding-bottom: 20px; 
          flex-wrap: wrap; gap: 20px; 
        }
        .header-title-wrap { 
          display: flex; align-items: center; gap: 16px; 
        }
        .header-icon {
          width: 48px; height: 48px;
          background: var(--gold-dim);
          color: var(--gold);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--border-accent);
        }
        .page-header h1 { margin: 0 0 6px 0; color: var(--text-primary); font-size: 1.6rem; font-weight: 800; }
        .page-header p { color: var(--text-secondary); margin: 0; font-size: 0.95rem; }
        
        /* ── ACTIONS BAR ── */
        .actions-bar { display: flex; gap: 15px; align-items: center; }
        .date-picker-group { 
          background: var(--bg-surface); 
          padding: 6px 16px; 
          border-radius: 10px; 
          border: 1px solid var(--border); 
          display: flex; gap: 12px; align-items: center; 
        }
        .date-separator { color: var(--text-muted); font-weight: 700; font-size: 0.9rem;}
        .date-input { 
          background: transparent; border: none; color: var(--text-primary); 
          padding: 6px; outline: none; font-family: inherit; 
          color-scheme: dark; cursor: pointer; font-weight: 600; font-size: 0.95rem;
        }
        
        .export-btn { 
          background: var(--gold); color: #111009; 
          border: none; padding: 12px 22px; border-radius: 10px; 
          cursor: pointer; font-weight: 800; font-size: 0.95rem;
          transition: all 0.2s; display: flex; align-items: center; gap: 8px; 
        }
        .export-btn:hover:not(:disabled) { 
          background: var(--gold-light); 
          box-shadow: 0 4px 15px rgba(201,168,76,0.3); 
          transform: translateY(-2px); 
        }
        .export-btn:disabled { 
          background: var(--bg-elevated); border: 1px solid var(--border);
          color: var(--text-muted); cursor: not-allowed; box-shadow: none; 
        }

        /* ── CARDS GRID ── */
        .cards-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); 
          gap: 20px; 
          margin-bottom: 30px; 
        }
        .stat-card { 
          background: var(--bg-surface); border: 1px solid var(--border); 
          padding: 22px; border-radius: 16px; display: flex; gap: 16px; 
          align-items: center; transition: all 0.2s; box-shadow: var(--shadow);
        }
        .stat-card:hover { transform: translateY(-4px); border-color: var(--border-accent); }
        
        .stat-card .icon { 
          width: 52px; height: 52px; border-radius: 14px; 
          display: flex; justify-content: center; align-items: center; 
          flex-shrink: 0; background: var(--bg-elevated); border: 1px solid var(--border); 
        }
        .default .icon { color: var(--text-secondary); }
        .total .icon { background: rgba(74, 222, 128, 0.1); color: #4ade80; border-color: rgba(74, 222, 128, 0.2); }
        .profit .icon.gold-icon { background: var(--gold-dim); color: var(--gold); border-color: var(--border-accent); }
        .due .icon.red-icon { background: rgba(248, 113, 113, 0.1); color: #f87171; border-color: rgba(248, 113, 113, 0.2); }

        .stat-card .content { min-width: 0; }
        .stat-card .content h3 { margin: 0 0 6px 0; color: var(--text-secondary); font-size: 0.88rem; font-weight: 700; }
        .stat-card .content p { margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--text-primary); }
        .val-success { color: #4ade80 !important; }
        .val-gold { color: var(--gold) !important; }
        .val-danger { color: #f87171 !important; }
        
        .badge { 
          font-size: 0.75rem; background: var(--bg-elevated); 
          padding: 4px 10px; border-radius: 6px; color: var(--text-muted); 
          margin-top: 10px; display: inline-block; border: 1px solid var(--border); font-weight: 600; 
        }
        .badge.warning { background: rgba(248, 113, 113, 0.1); color: #f87171; border-color: rgba(248, 113, 113, 0.2); }
        .badge.success { background: rgba(74, 222, 128, 0.1); color: #4ade80; border-color: rgba(74, 222, 128, 0.2); }

        /* ── TABLE CONTAINER ── */
        .table-container { 
          background: var(--bg-surface); border-radius: 16px; 
          border: 1px solid var(--border); overflow: hidden; box-shadow: var(--shadow); 
        }
        .table-header { padding: 22px 24px; border-bottom: 1px solid var(--border); background: var(--bg-elevated); }
        .table-header h3 { margin: 0; color: var(--gold); font-size: 1.15rem; font-weight: 700; }

        .table-responsive { 
          width: 100%; 
          overflow-x: auto; 
          -webkit-overflow-scrolling: touch; 
        }
        
        table { width: 100%; min-width: 950px; border-collapse: collapse; }
        th { 
          text-align: right; padding: 16px 20px; color: var(--text-secondary); 
          font-size: 0.85rem; background: var(--bg-base); font-weight: 700; 
          white-space: nowrap; text-transform: uppercase; border-bottom: 1px solid var(--border); 
        }
        td { 
          padding: 16px 20px; border-bottom: 1px solid var(--border); 
          color: var(--text-secondary); vertical-align: middle; white-space: nowrap; font-size: 0.95rem;
        }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: var(--gold-dimmer); }

        .count-badge {
          background: var(--bg-elevated); border: 1px solid var(--border);
          padding: 4px 10px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;
        }

        .btn-details { 
          background: var(--bg-elevated); border: 1px solid var(--border); 
          color: var(--text-secondary); padding: 8px 14px; border-radius: 8px; 
          cursor: pointer; font-size: 0.85rem; transition: all 0.2s; 
          white-space: nowrap; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;
        }
        .btn-details:hover:not(:disabled) { 
          border-color: var(--gold); color: var(--gold); 
          background: var(--gold-dim); transform: translateY(-2px); 
        }
        .btn-details:disabled { opacity: 0.6; cursor: not-allowed; }

        .empty-state { text-align: center; padding: 60px; color: var(--text-muted); font-size: 1.05rem; }

        /* ── LOADING & SCROLLBAR ── */
        .loading-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 0; color: var(--gold); font-weight: bold; }
        .spinner { width: 40px; height: 40px; border: 4px solid var(--border); border-top: 4px solid var(--gold); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 15px;}
        .small-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid var(--border); border-top: 2px solid var(--gold); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: var(--bg-base); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-accent); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--gold); }

        @media (max-width: 900px) {
            .header-section { flex-direction: column; align-items: flex-start; }
            .actions-bar { width: 100%; flex-direction: column; align-items: stretch; }
            .date-picker-group { width: 100%; justify-content: space-between; }
            .export-btn { width: 100%; justify-content: center; }
            .cards-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 500px) {
            .cards-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </SuperLayout>
  );
}
