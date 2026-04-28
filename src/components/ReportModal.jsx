import { useEffect, useState } from 'react';

const REPORT_REASONS = [
  '스팸 또는 광고',
  '혐오 표현',
  '괴롭힘 또는 위협',
  '음란물 또는 폭력',
  '저작권 침해',
  '잘못된 정보',
  '기타',
];

export const ReportModal = ({ open, onClose, onSubmit, target }) => {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (open) {
      setReason(REPORT_REASONS[0]);
      setDetail('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--rule-soft)',
          borderRadius: 4,
          padding: 32,
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          REPORT · 신고하기
        </div>
        <h3
          style={{
            fontFamily: 'var(--f-kr-serif)',
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
            color: 'var(--ink)',
          }}
        >
          무엇이 문제인가요?
        </h3>
        <p className="meta" style={{ fontSize: 11, marginBottom: 18 }}>
          {target?.label || '이 콘텐츠'}에 대한 신고는 운영진에게 익명으로 전달됩니다.
        </p>

        <div style={{ marginBottom: 20 }}>
          <div className="label" style={{ fontSize: 10, marginBottom: 8 }}>
            01 · 사유
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {REPORT_REASONS.map((r) => (
              <label
                key={r}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  padding: '8px 10px',
                  border: `1px solid ${reason === r ? 'var(--ink)' : 'var(--rule-soft)'}`,
                  fontFamily: 'var(--f-kr)',
                  fontSize: 13,
                  color: 'var(--ink-soft)',
                }}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  style={{ accentColor: 'var(--ink)' }}
                />
                {r}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div className="label" style={{ fontSize: 10, marginBottom: 6 }}>
            02 · 추가 설명 (선택)
          </div>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="구체적인 상황을 알려주시면 더 정확하게 검토할 수 있어요."
            style={{
              width: '100%',
              resize: 'none',
              border: 'none',
              borderBottom: '1px solid var(--rule-soft)',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--f-kr)',
              fontSize: 14,
              color: 'var(--ink)',
              padding: '8px 0',
              lineHeight: 1.6,
            }}
          />
          <div className="meta" style={{ fontSize: 10, marginTop: 4, textAlign: 'right' }}>
            {detail.length} / 300
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span className="meta" style={{ fontSize: 10 }}>
            Esc · 닫기
          </span>
          <span style={{ display: 'flex', gap: 10 }}>
            <button className="btn ghost" onClick={onClose}>
              취소
            </button>
            <button
              className="btn solid"
              onClick={() => {
                onSubmit({ reason, detail });
                onClose();
              }}
            >
              신고 접수 <span className="arr">→</span>
            </button>
          </span>
        </div>
      </div>
    </div>
  );
};
