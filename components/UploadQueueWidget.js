import { useState } from 'react';

// ===================================================================
// 🎯 UploadQueueWidget
// نافذة عائمة صغيرة تظهر أسفل الشاشة وتعرض كل عمليات رفع الفيديو
// الجارية/المنتهية إلى Bunny Stream — تسمح للمعلم بمتابعة عدة رفعات
// في نفس الوقت دون أن تمنعه من فتح نافذة "إضافة فيديو" لفصل آخر.
// ===================================================================

const STATUS_LABELS = {
  requesting: 'جاري إعداد جلسة الرفع...',
  uploading: 'جاري الرفع...',
  confirming: 'جاري حفظ البيانات...',
  done: 'اكتمل الرفع ✅',
  error: 'حدث خطأ',
  cancelled: 'تم الإلغاء',
};

function StatusIcon({ status }) {
  if (status === 'done') return <span style={{ color: 'var(--success, #22c55e)' }}>✅</span>;
  if (status === 'error') return <span style={{ color: 'var(--danger, #ef4444)' }}>❌</span>;
  if (status === 'cancelled') return <span style={{ color: 'var(--text-muted)' }}>⏹</span>;
  return <span className="spinner" />;
}

export default function UploadQueueWidget({ uploads, onCancel, onResume, onDismiss }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!uploads || uploads.length === 0) return null;

  const activeCount = uploads.filter((u) =>
    ['requesting', 'uploading', 'confirming'].includes(u.status)
  ).length;

  return (
    <div className={`upload-queue-widget ${collapsed ? 'collapsed' : ''}`}>
      <div className="uqw-header" onClick={() => setCollapsed((c) => !c)}>
        <span className="uqw-title">
          📤 رفع الفيديوهات {activeCount > 0 ? `(${activeCount} جارٍ)` : ''}
        </span>
        <button
          type="button"
          className="uqw-toggle"
          onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
          aria-label={collapsed ? 'توسيع' : 'تصغير'}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="uqw-list">
          {uploads.map((u) => (
            <div key={u.id} className="uqw-item">
              <div className="uqw-item-top">
                <StatusIcon status={u.status} />
                <div className="uqw-item-text">
                  <div className="uqw-item-title" title={u.title}>{u.title}</div>
                  {u.chapterTitle && (
                    <div className="uqw-item-sub">📂 {u.chapterTitle}</div>
                  )}
                </div>
                {['done', 'error', 'cancelled'].includes(u.status) && (
                  <button
                    type="button"
                    className="uqw-dismiss"
                    onClick={() => onDismiss?.(u.id)}
                    aria-label="إغلاق"
                  >
                    ✕
                  </button>
                )}
              </div>

              {['requesting', 'uploading', 'confirming'].includes(u.status) && (
                <div className="uqw-progress-track">
                  <div className="uqw-progress-fill" style={{ width: `${u.progress}%` }} />
                </div>
              )}

              <div className="uqw-item-status">
                {u.status === 'error' && u.error ? u.error : STATUS_LABELS[u.status]}
                {u.status === 'uploading' && ` ${u.progress}%`}
              </div>

              <div className="uqw-item-acts">
                {u.status === 'uploading' && (
                  <button type="button" className="uqw-btn cancel" onClick={() => onCancel?.(u.id)}>
                    إلغاء
                  </button>
                )}
                {u.status === 'error' && (
                  <>
                    <button type="button" className="uqw-btn resume" onClick={() => onResume?.(u.id)}>
                      استكمال
                    </button>
                    <button type="button" className="uqw-btn cancel" onClick={() => onDismiss?.(u.id)}>
                      تجاهل
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .upload-queue-widget {
          position: fixed;
          bottom: 20px;
          left: 20px;
          width: 320px;
          max-width: calc(100vw - 40px);
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
          z-index: 9999;
          overflow: hidden;
          direction: rtl;
        }

        .uqw-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: var(--gold-dimmer);
          cursor: pointer;
          user-select: none;
        }

        .uqw-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--gold);
        }

        .uqw-toggle {
          background: none;
          border: none;
          color: var(--gold);
          cursor: pointer;
          font-size: 0.8rem;
          padding: 4px;
        }

        .uqw-list {
          max-height: 320px;
          overflow-y: auto;
          padding: 8px;
        }

        .uqw-item {
          background: var(--bg-base);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 8px;
        }
        .uqw-item:last-child { margin-bottom: 0; }

        .uqw-item-top {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .uqw-item-text {
          flex: 1;
          min-width: 0;
        }

        .uqw-item-title {
          font-size: 0.85rem;
          color: var(--text-primary);
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .uqw-item-sub {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .uqw-dismiss {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.85rem;
          padding: 2px 4px;
        }
        .uqw-dismiss:hover { color: var(--danger, #ef4444); }

        .uqw-progress-track {
          width: 100%;
          height: 6px;
          background: var(--bg-elevated);
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid var(--border);
          margin-top: 8px;
        }

        .uqw-progress-fill {
          height: 100%;
          background: var(--gold);
          transition: width 0.2s ease;
        }

        .uqw-item-status {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 6px;
        }

        .uqw-item-acts {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .uqw-btn {
          flex: 1;
          font-size: 0.75rem;
          padding: 6px 8px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .uqw-btn.resume { border-color: var(--gold); color: var(--gold); }
        .uqw-btn.resume:hover { background: var(--gold-dim); }
        .uqw-btn.cancel:hover { border-color: var(--danger, #ef4444); color: var(--danger, #ef4444); }

        .spinner {
          width: 14px;
          height: 14px;
          margin-top: 2px;
          border: 2px solid var(--border);
          border-top-color: var(--gold);
          border-radius: 50%;
          display: inline-block;
          animation: uqw-spin 0.8s linear infinite;
        }

        @keyframes uqw-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .upload-queue-widget { left: 10px; bottom: 10px; width: calc(100vw - 20px); }
        }
      `}</style>
    </div>
  );
}
