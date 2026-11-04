import { useState, useEffect } from 'react';
import FlashcardBulkImport, { FlashcardBulkImageImport } from './FlashcardBulkImport'; // 📋 استيراد من نص (Step 9) + 🖼️ صور بالجملة (Step 10)
import useImageResizeUpload, { isAllowedImage, MAX_INPUT_BYTES } from '../hooks/useImageResizeUpload'; // 🖼️ تصغير + رفع (Step 10)

// ============================================================
// 🗂️ محرر مجموعة الفلاش كاردس (Deck Editor) — لوحة المعلم
// ------------------------------------------------------------
// - يحمّل المجموعة (إن وُجد deckId) ثم يحفظها كاملة عبر /api/dashboard/teacher/flashcards (save_deck)
// - الحفظ upsert بمعرّف البطاقة: نُبقي id كما رجع من السيرفر حتى يبقى تقدم الطلاب المحلي صالحاً
// - قواعد التحقق هنا مطابقة لقواعد الباك إند (الحد الأقصى 500 بطاقة، كل وجه نص أو صورة)
// - وضع المعاينة يعرض البطاقات بنفس تجربة الطالب (قلب بالضغط)
// ============================================================

const MAX_CARDS = 500;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 1000;
const MAX_CARD_TEXT = 5000;
const ACCENT = '#8B5CF6';

let keySeq = 0;
const newKey = () => `c${Date.now()}_${keySeq++}`;

const emptyCard = () => ({ _key: newKey(), id: null, front_text: '', back_text: '', front_image_file_id: null, back_image_file_id: null });
const fromServer = (c) => ({
  _key: newKey(),
  id: c.id,
  front_text: c.front_text || '',
  back_text: c.back_text || '',
  front_image_file_id: c.front_image_file_id || null,
  back_image_file_id: c.back_image_file_id || null,
});

// معاينة الصور داخل لوحة التحكم عبر البروكسي (يعمل بكوكي المعلم)
const imgUrl = (file) => `/api/admin/file-proxy?type=exam_images&filename=${encodeURIComponent(file)}`;

export default function FlashcardDeckEditor({ deckId = null, subjectId, canManage = true, deniedMessage = '', onClose, onSaved, showAlert }) {
  const [id, setId] = useState(deckId);
  const [loading, setLoading] = useState(!!deckId);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [notifyStudents, setNotifyStudents] = useState(false); // 🔔 للإنشاء فقط (يختفي بعد أول حفظ)
  const [cards, setCards] = useState(() => (deckId ? [] : [emptyCard()]));

  const [mode, setMode] = useState('edit'); // 'edit' | 'preview'
  const [showImport, setShowImport] = useState(false);
  const [showImageImport, setShowImageImport] = useState(false);
  const { uploadOne } = useImageResizeUpload(); // رفع صورة واحدة مع التصغير
  const [uploading, setUploading] = useState({}); // { 'cardKey:front': true }
  const [pIndex, setPIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const alertMsg = (type, msg) => (showAlert ? showAlert(type, msg) : null);

  // ---------- تحميل المجموعة ----------
  const applyDeck = (deck) => {
    setId(deck.id);
    setTitle(deck.title || '');
    setDescription(deck.description || '');
    setIsActive(deck.is_active !== false);
    setCards((deck.cards || []).map(fromServer));
    setDirty(false);
  };

  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/dashboard/teacher/flashcards?mode=deck&id=${deckId}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.deck) applyDeck(data.deck);
        else { alertMsg('error', data.error || 'تعذر تحميل المجموعة'); onClose && onClose(); }
      } catch (e) {
        if (!cancelled) { alertMsg('error', 'خطأ في الاتصال'); onClose && onClose(); }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // تحذير المتصفح عند إغلاق الصفحة مع تغييرات غير محفوظة
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // ---------- تعديل الحالة ----------
  const touch = () => setDirty(true);
  const updateCard = (key, patch) => { setCards(cs => cs.map(c => (c._key === key ? { ...c, ...patch } : c))); touch(); };
  const addCard = () => {
    if (cards.length >= MAX_CARDS) return alertMsg('error', `الحد الأقصى ${MAX_CARDS} بطاقة في المجموعة`);
    setCards(cs => [...cs, emptyCard()]); touch();
  };
  const duplicateCard = (i) => {
    if (cards.length >= MAX_CARDS) return alertMsg('error', `الحد الأقصى ${MAX_CARDS} بطاقة في المجموعة`);
    setCards(cs => {
      const copy = { ...cs[i], _key: newKey(), id: null }; // نسخة جديدة (نفس الصور بنفس أسماء الملفات)
      return [...cs.slice(0, i + 1), copy, ...cs.slice(i + 1)];
    });
    touch();
  };
  const deleteCard = (i) => { setCards(cs => cs.filter((_, idx) => idx !== i)); touch(); };
  const moveCard = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= cards.length) return;
    setCards(cs => { const a = [...cs]; [a[i], a[j]] = [a[j], a[i]]; return a; });
    touch();
  };

  // ---------- استيراد من نص ----------
  // الصفوف القادمة { front, back } تصبح بطاقات جديدة (بدون id) داخل المحرر فقط — تحتاج «حفظ».
  // عند الإضافة نُسقط البطاقات الفارغة تماماً (مثل البطاقة الافتراضية لمجموعة جديدة).
  const handleImport = (rows, importMode) => {
    const imported = rows.map(r => ({ ...emptyCard(), front_text: r.front, back_text: r.back }));
    const isBlank = (c) => !c.id && !c.front_text.trim() && !c.back_text.trim() && !c.front_image_file_id && !c.back_image_file_id;
    setCards(cs => (importMode === 'replace' ? imported : [...cs.filter(c => !isBlank(c)), ...imported]));
    touch();
    setShowImport(false);
    alertMsg('success', `تمت إضافة ${imported.length} بطاقة — اضغط «حفظ» لتثبيتها`);
  };

  // ---------- استيراد صور بالجملة (Step 10) ----------
  // بطاقة لكل صورة (الوجه أو الظهر حسب الاختيار)، تُضاف في النهاية. الجهة الأخرى فارغة ليكتب المعلم نصها.
  const handleImageImport = (images, side) => {
    const imported = images.map(img => ({ ...emptyCard(), [`${side}_image_file_id`]: img.fileName }));
    const isBlank = (c) => !c.id && !c.front_text.trim() && !c.back_text.trim() && !c.front_image_file_id && !c.back_image_file_id;
    setCards(cs => [...cs.filter(c => !isBlank(c)), ...imported]);
    touch();
    setShowImageImport(false);
    alertMsg('success', `تمت إضافة ${imported.length} بطاقة بصور — أضف نص الجهة الأخرى ثم اضغط «حفظ»`);
  };

  // ---------- رفع الصور ----------
  const uploadImage = async (card, side, file) => {
    if (!file) return;
    if (!isAllowedImage(file)) return alertMsg('error', 'الصيغ المسموحة: PNG أو JPG');
    if (file.size > MAX_INPUT_BYTES) return alertMsg('error', 'حجم الصورة أكبر من 30 ميجا.');
    if (!canManage) return alertMsg('error', deniedMessage);

    const k = `${card._key}:${side}`;
    setUploading(u => ({ ...u, [k]: true }));
    try {
      // تصغير في المتصفح (≤1200px, JPEG) ثم رفع؛ يُرجع اسم الملف المحفوظ فقط
      const fileName = await uploadOne(file);
      updateCard(card._key, { [`${side}_image_file_id`]: fileName });
    } catch (e) {
      alertMsg('error', e.message || 'فشل رفع الصورة');
    }
    setUploading(u => { const n = { ...u }; delete n[k]; return n; });
  };

  // ---------- التحقق (مطابق للباك إند) ----------
  const validate = () => {
    const t = title.trim();
    if (!t) return 'عنوان المجموعة مطلوب';
    if (t.length > MAX_TITLE) return `عنوان المجموعة أطول من ${MAX_TITLE} حرف`;
    if (description.trim().length > MAX_DESCRIPTION) return `الوصف أطول من ${MAX_DESCRIPTION} حرف`;
    if (cards.length > MAX_CARDS) return `الحد الأقصى ${MAX_CARDS} بطاقة`;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const n = i + 1;
      if (c.front_text.trim().length > MAX_CARD_TEXT) return `البطاقة ${n}: نص الوجه أطول من ${MAX_CARD_TEXT} حرف`;
      if (c.back_text.trim().length > MAX_CARD_TEXT) return `البطاقة ${n}: نص الظهر أطول من ${MAX_CARD_TEXT} حرف`;
      if (!c.front_text.trim() && !c.front_image_file_id) return `البطاقة ${n}: وجه البطاقة فارغ (أضف نصاً أو صورة)`;
      if (!c.back_text.trim() && !c.back_image_file_id) return `البطاقة ${n}: ظهر البطاقة فارغ (أضف نصاً أو صورة)`;
    }
    return null;
  };

  const isUploading = Object.keys(uploading).length > 0;

  // ---------- الحفظ ----------
  const save = async () => {
    if (!canManage) return alertMsg('error', deniedMessage);
    if (isUploading) return alertMsg('error', 'انتظر انتهاء رفع الصور أولاً');
    const err = validate();
    if (err) return alertMsg('error', err);

    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/teacher/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_deck',
          payload: {
            id,
            subjectId,
            title: title.trim(),
            description: description.trim(),
            is_active: isActive,
            // 🔔 يُرسل فقط لمجموعة جديدة ظاهرة؛ السيرفر يتجاهله عند التعديل أو إن كانت المجموعة مخفية/فارغة
            notifyStudents: !id && isActive && notifyStudents,
            cards: cards.map(c => ({
              id: c.id,
              front_text: c.front_text,
              back_text: c.back_text,
              front_image_file_id: c.front_image_file_id,
              back_image_file_id: c.back_image_file_id,
            })),
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.deck) {
        const askedToNotify = !id && isActive && notifyStudents;
        applyDeck(data.deck); // نعتمد ما رجع من السيرفر (معرّفات البطاقات الجديدة)
        setNotifyStudents(false); // الإشعار مرة واحدة فقط عند الإنشاء
        if (askedToNotify && data.notified) alertMsg('success', 'تم حفظ المجموعة وإرسال الإشعار للطلاب');
        else if (askedToNotify) alertMsg('error', 'تم حفظ المجموعة لكن لم يُرسل الإشعار (تأكد أن المجموعة ظاهرة وفيها بطاقات)');
        else alertMsg('success', 'تم حفظ المجموعة');
        onSaved && onSaved(data.deck);
      } else {
        alertMsg('error', data.error || 'فشل الحفظ');
      }
    } catch (e) {
      alertMsg('error', 'خطأ في الاتصال');
    }
    setSaving(false);
  };

  const requestClose = () => {
    if (dirty && !window.confirm('لديك تغييرات غير محفوظة. هل تريد الإغلاق دون حفظ؟')) return;
    onClose && onClose();
  };

  // ---------- المعاينة ----------
  const startPreview = () => { setPIndex(0); setFlipped(false); setMode('preview'); };
  const pCard = cards[pIndex];
  const goPreview = (d) => { setPIndex(i => Math.min(Math.max(i + d, 0), cards.length - 1)); setFlipped(false); };

  const renderFace = (text, image) => (
    <div className="face-content">
      {image && <img src={imgUrl(image)} alt="" />}
      {text && <p>{text}</p>}
      {!text && !image && <p className="muted">— فارغ —</p>}
    </div>
  );

  const renderSide = (card, side, label) => {
    const imgKey = `${side}_image_file_id`;
    const textKey = `${side}_text`;
    const busy = !!uploading[`${card._key}:${side}`];
    return (
      <div className="side">
        <label className="side-label">{label}</label>
        <textarea
          className="input"
          rows={3}
          value={card[textKey]}
          maxLength={MAX_CARD_TEXT}
          onChange={e => updateCard(card._key, { [textKey]: e.target.value })}
          placeholder="النص..."
        />
        <div className="img-row">
          {card[imgKey] ? (
            <div className="img-thumb">
              <img src={imgUrl(card[imgKey])} alt="" />
              <button type="button" className="img-remove" title="إزالة الصورة" onClick={() => updateCard(card._key, { [imgKey]: null })}>✕</button>
            </div>
          ) : (
            <label className={`img-add${busy ? ' busy' : ''}`}>
              {busy ? 'جاري الرفع... ⏳' : '🖼️ إضافة صورة'}
              <input
                type="file"
                accept="image/png,image/jpeg"
                hidden
                disabled={busy}
                onChange={e => { uploadImage(card, side, e.target.files[0]); e.target.value = ''; }}
              />
            </label>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fc-overlay">
      <div className="fc-header">
        <h3>{id ? 'تعديل مجموعة فلاش كاردس' : 'مجموعة فلاش كاردس جديدة'}</h3>
        <div className="fc-header-actions">
          {mode === 'edit' ? (
            <button type="button" className="fc-btn" onClick={startPreview} disabled={loading || cards.length === 0}>👁️ معاينة</button>
          ) : (
            <button type="button" className="fc-btn" onClick={() => setMode('edit')}>✏️ رجوع للتعديل</button>
          )}
          <button type="button" className="fc-btn primary" onClick={save} disabled={loading || saving || isUploading}>
            {saving ? 'جاري الحفظ...' : '💾 حفظ'}
          </button>
          <button type="button" className="fc-btn" onClick={requestClose}>إغلاق ✕</button>
        </div>
      </div>

      {loading ? (
        <div className="fc-body"><p className="muted center">جاري التحميل...</p></div>
      ) : mode === 'preview' ? (
        <div className="fc-body preview">
          {!pCard ? (
            <p className="muted center">لا توجد بطاقات للمعاينة</p>
          ) : (
            <>
              <div className="preview-counter">{pIndex + 1} / {cards.length}</div>
              <div className={`flip-card${flipped ? ' flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
                <div className="flip-inner">
                  <div className="flip-face front">{renderFace(pCard.front_text, pCard.front_image_file_id)}</div>
                  <div className="flip-face back">{renderFace(pCard.back_text, pCard.back_image_file_id)}</div>
                </div>
              </div>
              <p className="muted center">اضغط على البطاقة لقلبها</p>
              <div className="preview-nav">
                <button type="button" className="fc-btn" onClick={() => goPreview(-1)} disabled={pIndex === 0}>→ السابقة</button>
                <button type="button" className="fc-btn" onClick={() => goPreview(1)} disabled={pIndex >= cards.length - 1}>التالية ←</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="fc-body">
          {!canManage && <div className="fc-warn">{deniedMessage}</div>}

          <div className="fc-meta">
            <div className="form-group">
              <label>عنوان المجموعة</label>
              <input className="input" value={title} maxLength={MAX_TITLE} onChange={e => { setTitle(e.target.value); touch(); }} placeholder="مثال: مصطلحات الفصل الأول" />
            </div>
            <div className="form-group">
              <label>الوصف (اختياري)</label>
              <textarea className="input" rows={2} value={description} maxLength={MAX_DESCRIPTION} onChange={e => { setDescription(e.target.value); touch(); }} />
            </div>
            <div className="toggle-row">
              <span>{isActive ? 'ظاهرة للطلاب' : 'مخفية عن الطلاب'}</span>
              <label className="switch">
                <input type="checkbox" checked={isActive} onChange={e => { setIsActive(e.target.checked); touch(); }} />
                <span className="slider round"></span>
              </label>
            </div>
            {!id && isActive && canManage && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'var(--text-secondary)', marginTop: '12px' }}>
                <input
                  type="checkbox"
                  style={{ width: '18px', height: '18px', accentColor: 'var(--gold)' }}
                  checked={notifyStudents}
                  onChange={e => setNotifyStudents(e.target.checked)}
                />
                <span>إرسال إشعار للطلاب المشتركين في المادة عند الحفظ</span>
              </label>
            )}
          </div>

          <div className="cards-head">
            <h4>البطاقات ({cards.length}/{MAX_CARDS})</h4>
            <div className="cards-head-actions">
              <button type="button" className="fc-btn" onClick={() => setShowImport(true)}>📋 استيراد من نص</button>
              <button type="button" className="fc-btn" onClick={() => (canManage ? setShowImageImport(true) : alertMsg('error', deniedMessage))}>🖼️ استيراد صور</button>
              <button type="button" className="fc-btn primary" onClick={addCard}>+ بطاقة</button>
            </div>
          </div>

          {cards.length === 0 && <p className="muted center">لا توجد بطاقات بعد. اضغط «+ بطاقة» للبدء.</p>}

          {cards.map((card, i) => (
            <div className="card-row" key={card._key}>
              <div className="card-row-head">
                <span className="card-num">{i + 1}</span>
                <div className="card-tools">
                  <button type="button" title="أعلى" onClick={() => moveCard(i, -1)} disabled={i === 0}>↑</button>
                  <button type="button" title="أسفل" onClick={() => moveCard(i, 1)} disabled={i === cards.length - 1}>↓</button>
                  <button type="button" title="تكرار" onClick={() => duplicateCard(i)}>⧉</button>
                  <button type="button" title="حذف" className="danger" onClick={() => deleteCard(i)}>🗑</button>
                </div>
              </div>
              <div className="sides">
                {renderSide(card, 'front', 'الوجه (السؤال)')}
                {renderSide(card, 'back', 'الظهر (الإجابة)')}
              </div>
            </div>
          ))}

          {cards.length > 0 && (
            <button type="button" className="fc-btn add-bottom" onClick={addCard}>+ إضافة بطاقة</button>
          )}
        </div>
      )}

      {showImageImport && (
        <FlashcardBulkImageImport
          existingCount={cards.filter(c => c.id || c.front_text.trim() || c.back_text.trim() || c.front_image_file_id || c.back_image_file_id).length}
          maxCards={MAX_CARDS}
          canManage={canManage}
          deniedMessage={deniedMessage}
          onImport={handleImageImport}
          onClose={() => setShowImageImport(false)}
        />
      )}

      {showImport && (
        <FlashcardBulkImport
          existingCount={cards.filter(c => c.id || c.front_text.trim() || c.back_text.trim() || c.front_image_file_id || c.back_image_file_id).length}
          maxCards={MAX_CARDS}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}

      <style jsx>{`
        .fc-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000; background: var(--bg-base); display: flex; flex-direction: column; }
        .fc-header { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 14px 20px; background: var(--bg-elevated); border-bottom: 1px solid var(--border); }
        .fc-header h3 { margin: 0; color: ${ACCENT}; font-size: 1.1rem; }
        .fc-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .fc-body { flex: 1; overflow-y: auto; padding: 20px; max-width: 900px; width: 100%; margin: 0 auto; box-sizing: border-box; }
        .fc-btn { background: var(--bg-surface); color: var(--text-secondary); border: 1px solid var(--border); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-family: inherit; font-weight: bold; transition: 0.2s; }
        .fc-btn:hover:not(:disabled) { border-color: ${ACCENT}; color: ${ACCENT}; }
        .fc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .fc-btn.primary { background: ${ACCENT}; border-color: ${ACCENT}; color: #fff; }
        .fc-btn.primary:hover:not(:disabled) { opacity: 0.9; color: #fff; }
        .fc-warn { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); color: #ef4444; padding: 10px 14px; border-radius: 8px; margin-bottom: 15px; font-size: 0.9rem; }
        .fc-meta { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 20px; }
        .form-group { margin-bottom: 14px; }
        .form-group label, .side-label { display: block; margin-bottom: 6px; color: var(--text-secondary); font-size: 0.85rem; font-weight: bold; }
        .input { width: 100%; box-sizing: border-box; background: var(--bg-base); border: 1px solid var(--border); color: var(--text-primary); padding: 10px 12px; border-radius: 10px; font-family: inherit; resize: vertical; }
        .input:focus { border-color: ${ACCENT}; outline: none; box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.25); }
        .toggle-row { display: flex; justify-content: space-between; align-items: center; color: var(--text-secondary); }
        .switch { position: relative; display: inline-block; width: 44px; height: 22px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; inset: 0; background-color: var(--border); transition: 0.3s; }
        .slider.round { border-radius: 22px; }
        .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background: #fff; transition: 0.3s; border-radius: 50%; }
        input:checked + .slider { background-color: ${ACCENT}; }
        input:checked + .slider:before { transform: translateX(22px); }
        .cards-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .cards-head-actions { display: flex; gap: 8px; }
        .cards-head h4 { margin: 0; color: var(--text-primary); }
        .card-row { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 14px; }
        .card-row-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .card-num { background: rgba(139, 92, 246, 0.15); color: ${ACCENT}; font-weight: bold; min-width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; }
        .card-tools { display: flex; gap: 6px; }
        .card-tools button { background: var(--bg-elevated); border: 1px solid transparent; color: var(--text-secondary); border-radius: 6px; padding: 4px 9px; cursor: pointer; }
        .card-tools button:hover:not(:disabled) { border-color: ${ACCENT}; color: ${ACCENT}; }
        .card-tools button.danger:hover { border-color: rgba(239, 68, 68, 0.4); color: #ef4444; background: rgba(239, 68, 68, 0.12); }
        .card-tools button:disabled { opacity: 0.35; cursor: not-allowed; }
        .sides { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .img-row { margin-top: 8px; }
        .img-add { display: inline-block; padding: 8px 12px; border: 1px dashed var(--border-accent); color: var(--text-secondary); border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
        .img-add:hover { border-color: ${ACCENT}; color: ${ACCENT}; }
        .img-add.busy { opacity: 0.6; cursor: wait; }
        .img-thumb { position: relative; display: inline-block; }
        .img-thumb img { max-width: 100%; max-height: 120px; border-radius: 8px; border: 1px solid var(--border); display: block; }
        .img-remove { position: absolute; top: 4px; right: 4px; background: rgba(0, 0, 0, 0.65); color: #fff; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; line-height: 1; }
        .add-bottom { width: 100%; border-style: dashed; margin-bottom: 30px; }
        .muted { color: var(--text-muted); }
        .center { text-align: center; }
        .fc-body.preview { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; }
        .preview-counter { color: var(--text-secondary); font-weight: bold; }
        .flip-card { width: 100%; max-width: 560px; height: 340px; perspective: 1200px; cursor: pointer; }
        .flip-inner { position: relative; width: 100%; height: 100%; transition: transform 0.5s; transform-style: preserve-3d; }
        .flip-card.flipped .flip-inner { transform: rotateY(180deg); }
        .flip-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 18px; padding: 20px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; overflow: auto; text-align: center; }
        .flip-face.front { background: var(--bg-surface); border: 2px solid ${ACCENT}; }
        .flip-face.back { background: rgba(139, 92, 246, 0.12); border: 2px solid ${ACCENT}; transform: rotateY(180deg); }
        .face-content { display: flex; flex-direction: column; align-items: center; gap: 12px; max-width: 100%; }
        .face-content img { max-width: 100%; max-height: 180px; border-radius: 10px; }
        .face-content p { margin: 0; color: var(--text-primary); font-size: 1.25rem; white-space: pre-wrap; word-break: break-word; }
        .face-content p.muted { color: var(--text-muted); font-size: 1rem; }
        .preview-nav { display: flex; gap: 10px; }
        @media (max-width: 640px) {
          .sides { grid-template-columns: 1fr; }
          .fc-body { padding: 14px; }
          .flip-card { height: 300px; }
        }
      `}</style>
    </div>
  );
}
