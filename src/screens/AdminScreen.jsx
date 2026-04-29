import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar.jsx';
import { IconMoon, IconSun } from '../components/Icons.jsx';
import { TopBar } from '../components/TopBar.jsx';
import { useToast } from '../components/Toast.jsx';
import {
  createAdminKeywordSchedule,
  listAdminKeywordRecommendations,
  listAdminKeywordSchedule,
  listAdminKeywordSuggestions,
  listAdminReports,
  updateAdminKeywordSchedule,
  updateAdminKeywordSuggestion,
  updateAdminReport,
} from '../lib/api.js';
import { readString } from '../lib/storage.js';

const statusMeta = {
  live: { k:'LIVE', c:'var(--accent)' },
  scheduled: { k:'SCHEDULED', c:'var(--ink)' },
  draft: { k:'DRAFT', c:'var(--ink-faint)' },
  empty: { k:'EMPTY', c:'var(--ink-faint)' },
  archived: { k:'ARCHIVED', c:'var(--ink-faint)' },
};

const getNextPublishLabel = (schedule) => {
  const now = Date.now();
  const next = schedule
    .map((row) => row.startsAt ? new Date(row.startsAt).getTime() : null)
    .filter((time) => Number.isFinite(time) && time > now)
    .sort((a, b) => a - b)[0];
  if (!next) return '—';
  const diffMin = Math.max(0, Math.floor((next - now) / 60000));
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  return `${hours}H ${String(minutes).padStart(2, '0')}M`;
};

export const AdminScreen = ({onNav, dark, onToggleDark, user, onLogout}) => {
  const toast = useToast();
  const suggestRef = useRef(null);

  const [schedule, setSchedule] = useState([]);
  const [newDate, setNewDate]   = useState('');
  const [newWord, setNewWord]   = useState('');
  const [newEng, setNewEng]     = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [editIdx, setEditIdx]   = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportFilter, setReportFilter] = useState('open');
  const [reportBusyId, setReportBusyId] = useState(null);

  useEffect(() => {
    const token = readString('wh_auth_token');
    if (!token) return;
    listAdminKeywordSchedule(token)
      .then(({ schedule: remoteSchedule }) => {
        setSchedule(Array.isArray(remoteSchedule) ? remoteSchedule : []);
      })
      .catch((error) => {
        toast(error.message || '키워드 스케줄을 불러오지 못했습니다.', 'error');
      });
    listAdminReports(token)
      .then(({ reports: remoteReports }) => setReports(remoteReports || []))
      .catch(() => {});
    listAdminKeywordSuggestions(token)
      .then(({ suggestions: remoteSuggestions }) => setSuggestions(remoteSuggestions || []))
      .catch(() => {});
  }, []);

  /* ── AI generated drafts (awaiting editor review) ── */
  const [aiDrafts, setAiDrafts]   = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const aiRef = useRef(null);

  /* Words already used (current schedule + pending drafts) */
  const usedWords = useMemo(() => {
    const set = new Set();
    schedule.forEach(r => r.word && set.add(r.word));
    aiDrafts.forEach(d => set.add(d.word));
    return set;
  }, [schedule, aiDrafts]);

  const handleAIGenerate = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const token = readString('wh_auth_token');
      if (!token) {
        toast('관리자 로그인이 필요합니다.', 'error');
        return;
      }
      const response = await listAdminKeywordRecommendations({ count: 7, token });
      const drafts = (response.recommendations || []).filter((draft) => !usedWords.has(draft.word));
      setAiDrafts(drafts);
      toast(`AI 추천 키워드 ${drafts.length}개를 생성했습니다. 검수해주세요.`);
      setTimeout(() => aiRef.current?.scrollIntoView({behavior:'smooth'}), 50);
    } catch (error) {
      toast(error.message || 'AI 키워드 추천에 실패했습니다.', 'error');
    } finally { setAiLoading(false); }
  };

  const handleAIApprove = async (idx) => {
    const d = aiDrafts[idx];
    if (!d) return null;
    const token = readString('wh_auth_token');
    if (!token) {
      toast('관리자 로그인이 필요합니다.', 'error');
      return null;
    }
    try {
      const { schedule: saved } = await createAdminKeywordSchedule({
        date: d.date,
        word: d.word,
        eng: d.eng,
        prompt: d.prompt,
        status: 'scheduled',
        token,
      });
      setSchedule(s => [...s, saved].sort((a, b) => String(a.startsAt || a.date).localeCompare(String(b.startsAt || b.date))));
      setAiDrafts(arr => arr.filter((_, i) => i !== idx));
      toast(`${d.word} · ${d.eng} — 승인되어 예약되었습니다.`);
      return saved;
    } catch (error) {
      toast(error.message || '예약 등록에 실패했습니다.', 'error');
      throw error;
    }
  };

  const handleAIReject = (idx) => {
    const d = aiDrafts[idx];
    setAiDrafts(arr => arr.filter((_, i) => i !== idx));
    toast(`${d.word} — 반려되었습니다.`);
  };

  const handleAIRegenerate = async (idx) => {
    const token = readString('wh_auth_token');
    if (!token) {
      toast('관리자 로그인이 필요합니다.', 'error');
      return;
    }
    try {
      const response = await listAdminKeywordRecommendations({ count: 1, token });
      const [pick] = (response.recommendations || []).filter((draft) => !usedWords.has(draft.word));
      if (!pick) { toast('새로 추천할 키워드가 없습니다.'); return; }
      setAiDrafts(arr => arr.map((d, i) => i === idx ? pick : d));
      toast(`다시 추천되었습니다 · ${pick.word}`);
    } catch (error) {
      toast(error.message || '다시 추천에 실패했습니다.', 'error');
    }
  };

  const handleAIApproveAll = async () => {
    if (!aiDrafts.length) return;
    const drafts = [...aiDrafts];
    let approved = 0;
    for (const draft of drafts) {
      const idx = drafts.findIndex(item => item.word === draft.word && item.date === draft.date);
      if (idx >= 0) {
        try {
          const token = readString('wh_auth_token');
          if (!token) throw new Error('관리자 로그인이 필요합니다.');
          const { schedule: saved } = await createAdminKeywordSchedule({
            date: draft.date,
            word: draft.word,
            eng: draft.eng,
            prompt: draft.prompt,
            status: 'scheduled',
            token,
          });
          setSchedule(s => [...s, saved].sort((a, b) => String(a.startsAt || a.date).localeCompare(String(b.startsAt || b.date))));
          setAiDrafts(arr => arr.filter(item => !(item.word === draft.word && item.date === draft.date)));
          approved += 1;
        } catch (error) {
          toast(error.message || '일괄 승인 중 오류가 발생했습니다.', 'error');
          break;
        }
      }
    }
    if (approved > 0) toast(`${approved}개 키워드를 일괄 승인했습니다.`);
  };

  const handleSubmit = async () => {
    if (!newWord.trim()) { toast('한글 키워드를 입력해주세요.'); return; }
    if (!newEng.trim())  { toast('영문 키워드를 입력해주세요.'); return; }
    if (!newDate.trim()) { toast('발행일을 입력해주세요.'); return; }
    const token = readString('wh_auth_token');
    if (!token) { toast('관리자 로그인이 필요합니다.', 'error'); return; }
    try {
      const { schedule: saved } = await createAdminKeywordSchedule({
        date: newDate,
        word: newWord.trim(),
        eng: newEng.trim().toUpperCase(),
        prompt: newPrompt,
        status: 'scheduled',
        token,
      });
      setSchedule(s => [...s, saved].sort((a, b) => String(a.startsAt || a.date).localeCompare(String(b.startsAt || b.date))));
      toast(`${newWord} · ${newEng.toUpperCase()} — 예약 등록 완료`);
      setNewDate(''); setNewWord(''); setNewEng(''); setNewPrompt('');
    } catch (error) {
      toast(error.message || '예약 등록에 실패했습니다.', 'error');
    }
  };

  const handleAssignEmpty = (r) => {
    setNewDate(r.date);
    setNewWord(''); setNewEng('');
    suggestRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast(`${r.date} 슬롯 — 키워드를 입력해주세요`);
  };

  const handleEdit = (i) => {
    setEditIdx(editIdx === i ? null : i);
  };

  const handleEditSave = async (i) => {
    const row = schedule[i];
    const token = readString('wh_auth_token');
    if (token && row.id) {
      try {
        const { schedule: saved } = await updateAdminKeywordSchedule({
          id: row.id,
          date: row.date,
          word: row.word,
          eng: row.eng,
          status: row.status === 'live' ? 'live' : row.status || 'scheduled',
          token,
        });
        setSchedule(s => s.map((r, ri) => ri === i ? saved : r));
      } catch (error) {
        if (error.status !== 503 && error.status !== 401) {
          toast(error.message || '수정에 실패했습니다.');
          return;
        }
      }
    }
    toast(`${schedule[i].word} — 수정 완료`);
    setEditIdx(null);
  };

  const handleEditWordChange = (i, val) => {
    setSchedule(s => s.map((r, ri) => ri === i ? {...r, word: val} : r));
  };

  const handleApprove = async (s) => {
    if (!s) return;
    const token = readString('wh_auth_token');
    if (!token) return;
    try {
      const { suggestion } = await updateAdminKeywordSuggestion({ id: s.id, status: 'approved', token });
      setNewWord(s.word);
      setNewEng(s.eng || '');
      setNewPrompt(s.note ? `유저 제안: ${s.note}` : '');
      setSuggestions(arr => arr.map((item) => item.id === s.id ? suggestion : item));
      toast(`${s.word} — 폼에 불러왔습니다. 날짜를 지정해 예약하세요.`);
    } catch (error) {
      toast(error.message || '제안 승인에 실패했습니다.', 'error');
    }
    suggestRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleReject = async (s) => {
    if (!s) return;
    const token = readString('wh_auth_token');
    if (!token) return;
    try {
      const { suggestion } = await updateAdminKeywordSuggestion({ id: s.id, status: 'rejected', token });
      setSuggestions(arr => arr.map((item) => item.id === s.id ? suggestion : item));
      toast(`${s.word} — 제안을 반려했습니다.`);
    } catch (error) {
      toast(error.message || '제안 반려에 실패했습니다.', 'error');
    }
  };

  const handleReportStatus = async (report, nextStatus) => {
    const token = readString('wh_auth_token');
    if (!token) return;
    setReportBusyId(report.id);
    try {
      const { report: saved } = await updateAdminReport({ id: report.id, status: nextStatus, token });
      setReports(rs => rs.map(r => r.id === report.id ? saved : r));
      const labelMap = {
        reviewing: '검토 중으로 변경',
        resolved: '처리 완료 — 글이 숨김 처리되었습니다.',
        dismissed: '반려 처리되었습니다.',
        open: '재오픈 — 글이 다시 공개됩니다.',
      };
      toast(labelMap[nextStatus] || '상태가 변경되었습니다.');
    } catch (error) {
      toast(error.message || '신고 처리에 실패했습니다.', 'error');
    } finally {
      setReportBusyId(null);
    }
  };

  const reportStatusMeta = {
    open:      { label: '미처리', color: 'var(--accent)' },
    reviewing: { label: '검토 중', color: '#c89b3c' },
    resolved:  { label: '처리 완료', color: '#5a8f5a' },
    dismissed: { label: '반려', color: 'var(--ink-faint)' },
  };
  const reportFilterTabs = [
    ['open', '미처리'],
    ['reviewing', '검토 중'],
    ['resolved', '처리 완료'],
    ['dismissed', '반려'],
    ['all', '전체'],
  ];
  const filteredReports = reportFilter === 'all'
    ? reports
    : reports.filter(r => r.status === reportFilter);
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const reportCounts = reports.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  const adminStats = [
    ['예약된 키워드', String(schedule.filter(r=>r.status==='scheduled'||r.status==='draft').length), '일치'],
    ['미배정 슬롯', String(schedule.filter(r=>r.status==='empty').length), '일'],
    ['AI 검수 대기', String(aiDrafts.length), '건'],
    ['유저 제안', String(pendingSuggestions.length), '건'],
    ['신고 대기', String((reportCounts.open || 0) + (reportCounts.reviewing || 0)), '건'],
    ['다음 발행까지', getNextPublishLabel(schedule), ''],
  ];

  return (
    <div style={{overflowX:'hidden'}}>
      <TopBar active="profile" onNav={onNav} dark={dark} onToggleDark={onToggleDark} user={user} onLogout={onLogout} right={
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <span className="chip accent" style={{fontFamily:'var(--f-mono)', fontSize:10}}>ADMIN · EDITOR</span>
          <button className="dark-toggle" onClick={onToggleDark}>{dark?<IconSun/>:<IconMoon/>}</button>
          <Avatar url={user?.avatarUrl} initial={(user?.nickname||'운')[0]} size={32} fontSize={13} />
        </div>
      }/>
      <div className="wrap" style={{paddingTop:32}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:32, alignItems:'end', paddingBottom:24, borderBottom:'1px solid var(--rule)'}}>
          <div>
            <div className="eyebrow" style={{marginBottom:10}}>CURATION · 키워드 스케줄러</div>
            <h1 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:44, letterSpacing:'-0.025em', lineHeight:1, margin:0, color:'var(--ink)'}}>오늘 이후의 키워드</h1>
            <p style={{fontSize:14, color:'var(--ink-mute)', marginTop:10, maxWidth:'52ch', lineHeight:1.65}}>편집자가 매일 하나씩 예약 등록합니다. 매일 00:00 KST에 오늘의 키워드가 자동 발행됩니다.</p>
          </div>
          <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
            <button className="btn sm" onClick={() => suggestRef.current?.scrollIntoView({behavior:'smooth'})}>
              제안 검토 <span style={{color:'var(--accent)', marginLeft:4}}>●{suggestions.length}</span>
            </button>
            <button className="btn sm" onClick={handleAIGenerate} disabled={aiLoading}
              style={{borderColor:'var(--accent)', color:'var(--accent)'}}>
              {aiLoading ? '생성 중…' : '✦ AI로 7일치 생성'}
              {aiDrafts.length > 0 && <span style={{marginLeft:4}}>· 검수 {aiDrafts.length}</span>}
            </button>
            <button className="btn sm solid" onClick={() => suggestRef.current?.scrollIntoView({behavior:'smooth'})}>＋ 키워드 추가</button>
          </div>
        </div>

        <section style={{display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:32, padding:'22px 0', borderBottom:'1px solid var(--rule-soft)'}}>
          {adminStats.map(([k,v,s]) => (
            <div key={k}>
              <div className="label" style={{fontSize:10, marginBottom:6}}>{k}</div>
              <div style={{fontFamily:'var(--f-latin)', fontWeight:700, fontSize:28, letterSpacing:'-0.04em', color:'var(--ink)', fontVariantNumeric:'tabular-nums', lineHeight:1}}>
                {v} <span style={{fontSize:12, color:'var(--ink-mute)', fontFamily:'var(--f-kr)', fontWeight:500, marginLeft:2}}>{s}</span>
              </div>
            </div>
          ))}
        </section>

        <section style={{display:'grid', gridTemplateColumns:'1fr 340px', gap:40, padding:'28px 0'}}>
          <div>
            <div className="col-h">
              <h2>앞으로 14일</h2>
              <span className="meta">DATE · WORD · STATUS · CURATED BY</span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'90px 1fr 120px 120px 80px', gap:16, padding:'0 0 10px', borderBottom:'1px solid var(--rule)'}}>
              {['DATE','KEYWORD','STATUS','CURATED BY',''].map((h,i) => (
                <span key={i} className="label" style={{fontSize:10}}>{h}</span>
              ))}
            </div>

            {schedule.map((r, i) => {
              const st = statusMeta[r.status] || statusMeta.scheduled;
              const isToday = r.status === 'live';
              const empty = r.status === 'empty';
              const isEditing = editIdx === i;
              return (
                <div key={i} style={{
                  display:'grid', gridTemplateColumns:'90px 1fr 120px 120px 80px',
                  gap:16, padding:'16px 0', borderBottom:'1px solid var(--rule-ghost)',
                  alignItems:'center',
                  background: isToday ? 'var(--accent-soft)' : 'transparent',
                  marginLeft: isToday ? -12 : 0, marginRight: isToday ? -12 : 0,
                  paddingLeft: isToday ? 12 : 0, paddingRight: isToday ? 12 : 0,
                }}>
                  <div>
                    <div style={{fontFamily:'var(--f-latin)', fontWeight:600, fontSize:14, color:'var(--ink)', fontVariantNumeric:'tabular-nums'}}>{r.date}</div>
                    <div className="meta" style={{fontSize:10.5}}>{r.day}요일{isToday?' · 오늘':''}</div>
                  </div>
                  <div>
                    {empty ? (
                      <button className="btn sm ghost" style={{borderStyle:'dashed'}} onClick={() => handleAssignEmpty(r)}>＋ 키워드 배정</button>
                    ) : isEditing ? (
                      <input className="field" value={r.word} onChange={e => handleEditWordChange(i, e.target.value)}
                        style={{fontSize:16, padding:'4px 8px', fontFamily:'var(--f-kr-serif)', fontWeight:700}} />
                    ) : (
                      <div style={{display:'flex', alignItems:'baseline', gap:12}}>
                        <span style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:22, letterSpacing:'-0.02em', color:'var(--ink)'}}>{r.word}</span>
                        <span style={{fontFamily:'var(--f-serif)', fontSize:12, color:'var(--ink-faint)', letterSpacing:'0.08em'}}>{r.eng}</span>
                        {r.fixed && <span className="chip" style={{fontSize:10}}>📌 {r.fixed}</span>}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="status-chip" style={{borderColor:st.c, color:st.c}}>● {st.k}</span>
                  </div>
                  <div style={{fontFamily:'var(--f-kr)', fontSize:12.5, color:empty?'var(--ink-faint)':'var(--ink-soft)'}}>
                    {r.by||'—'}
                    {r.posts!==null && <div className="meta" style={{fontSize:10.5}}>{r.posts?.toLocaleString()} 편</div>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    {!empty && !isEditing && <button className="btn sm ghost" style={{padding:'5px 10px', fontSize:10}} onClick={() => handleEdit(i)}>편집</button>}
                    {isEditing && <button className="btn sm solid" style={{padding:'5px 10px', fontSize:10}} onClick={() => handleEditSave(i)}>저장</button>}
                  </div>
                </div>
              );
            })}
          </div>

          <aside style={{display:'flex', flexDirection:'column', gap:20}}>
            <div className="panel" ref={suggestRef}>
              <h4>키워드 예약하기</h4>
              <div style={{marginBottom:12}}>
                <div className="label" style={{fontSize:10, marginBottom:4}}>발행일</div>
                <input className="field" placeholder="예) 04·30" value={newDate} onChange={e=>setNewDate(e.target.value)} />
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>
                <div>
                  <div className="label" style={{fontSize:10, marginBottom:4}}>한글</div>
                  <input className="field" placeholder="예) 첫눈" value={newWord} onChange={e=>setNewWord(e.target.value)} />
                </div>
                <div>
                  <div className="label" style={{fontSize:10, marginBottom:4}}>영문</div>
                  <input className="field" placeholder="FIRST SNOW" value={newEng} onChange={e=>setNewEng(e.target.value)} />
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div className="label" style={{fontSize:10, marginBottom:4}}>프롬프트 (선택)</div>
                <textarea className="field" placeholder="오늘의 키워드 아래에 보여줄 안내 문구" value={newPrompt} onChange={e=>setNewPrompt(e.target.value)}
                  style={{minHeight:72, resize:'none', border:'none', borderBottom:'1px solid var(--rule-soft)', outline:'none', background:'transparent', fontFamily:'var(--f-kr)', fontSize:14, color:'var(--ink)', width:'100%'}} />
              </div>
              <button className="btn accent" style={{width:'100%', justifyContent:'center'}} onClick={handleSubmit}>예약 등록</button>
            </div>

            <div className="panel" ref={aiRef} style={{borderColor:aiDrafts.length?'var(--accent)':undefined}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6}}>
                <h4 style={{margin:0}}>✦ AI 검수 대기 · {aiDrafts.length}</h4>
                {aiDrafts.length > 0 && (
                  <button className="btn sm" style={{padding:'4px 10px', fontSize:10, color:'var(--accent)', borderColor:'var(--accent)'}} onClick={handleAIApproveAll}>전체 승인</button>
                )}
              </div>
              <div className="meta" style={{fontSize:10.5, marginBottom:10}}>일주일치를 미리 생성하고 한 건씩 검수하세요. 이미 사용된 키워드는 자동 제외됩니다.</div>
              {aiLoading && (
                <div style={{padding:'24px 0', textAlign:'center', color:'var(--ink-mute)', fontFamily:'var(--f-mono)', fontSize:11.5}}>
                  AI가 키워드를 생성하는 중…
                </div>
              )}
              {!aiLoading && aiDrafts.length === 0 && (
                <div style={{padding:'16px 0', textAlign:'center', color:'var(--ink-mute)', fontFamily:'var(--f-mono)', fontSize:11}}>
                  검수 대기 중인 초안이 없습니다.<br/>
                  <button className="btn sm" style={{marginTop:10, color:'var(--accent)', borderColor:'var(--accent)'}} onClick={handleAIGenerate} disabled={aiLoading}>지금 생성</button>
                </div>
              )}
              {aiDrafts.map((d, i) => (
                <div key={i} style={{padding:'10px 0', borderBottom:'1px solid var(--rule-ghost)'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8}}>
                    <div style={{minWidth:0, flex:1}}>
                      <div style={{display:'flex', alignItems:'baseline', gap:8}}>
                        <span className="meta" style={{fontSize:10, fontFamily:'var(--f-mono)'}}>{d.date} · {d.day}</span>
                      </div>
                      <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:2}}>
                        <span style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:17, color:'var(--ink)'}}>{d.word}</span>
                        <span style={{fontFamily:'var(--f-serif)', fontSize:11, color:'var(--ink-faint)', letterSpacing:'0.08em'}}>{d.eng}</span>
                      </div>
                    </div>
                    <div style={{display:'flex', gap:4, flexShrink:0}}>
                      <button className="btn sm ghost" style={{padding:'4px 8px', fontSize:10, color:'var(--accent)'}}
                        onClick={() => handleAIApprove(i)} title="승인">✓</button>
                      <button className="btn sm ghost" style={{padding:'4px 8px', fontSize:10}}
                        onClick={() => handleAIRegenerate(i)} title="다시 생성">↻</button>
                      <button className="btn sm ghost" style={{padding:'4px 8px', fontSize:10}}
                        onClick={() => handleAIReject(i)} title="반려">✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel">
              <h4>유저 제안 대기 · {pendingSuggestions.length}</h4>
              {pendingSuggestions.length === 0 && (
                <div style={{padding:'16px 0', textAlign:'center', color:'var(--ink-mute)', fontFamily:'var(--f-mono)', fontSize:11}}>대기 중인 제안이 없습니다.</div>
              )}
              {pendingSuggestions.map((s) => (
                <div key={s.id} style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, padding:'10px 0', borderBottom:'1px solid var(--rule-ghost)'}}>
                  <div>
                    <div style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:15, color:'var(--ink)'}}>{s.word}</div>
                    <div className="meta" style={{fontSize:10.5}}>
                      {s.by}{s.handle ? ` · @${s.handle}` : ''}{s.eng ? ` · ${s.eng}` : ''}
                    </div>
                    {s.note && (
                      <div style={{fontSize:11.5, color:'var(--ink-mute)', lineHeight:1.5, marginTop:4, maxWidth:210}}>
                        {s.note}
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex', gap:4}}>
                    <button className="btn sm ghost" style={{padding:'4px 8px', fontSize:10, color:'var(--accent)'}} onClick={() => handleApprove(s)}>✓</button>
                    <button className="btn sm ghost" style={{padding:'4px 8px', fontSize:10}} onClick={() => handleReject(s)}>✕</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel" style={{background:'var(--paper-2)'}}>
              <h4>발행 로직</h4>
              <div style={{fontFamily:'var(--f-mono)', fontSize:11, color:'var(--ink-soft)', lineHeight:1.75}}>
                <div>00:00 KST · 매일 자동 발행</div>
                <div>↓</div>
                <div>scheduled_date = today()</div>
                <div>↓ 없으면</div>
                <div>status = 'empty' · 운영 알림</div>
                <div>↓ 폴백</div>
                <div>과거 인기 키워드 재활용</div>
              </div>
            </div>
          </aside>
        </section>

        <section style={{padding:'28px 0', borderTop:'1px solid var(--rule)'}}>
          <div className="col-h">
            <h2>모더레이션 큐 · 신고 처리</h2>
            <span className="meta">REPORTED POSTS · REVIEW &amp; RESOLVE</span>
          </div>
          <div style={{display:'flex', gap:8, padding:'8px 0 16px', borderBottom:'1px solid var(--rule-soft)', flexWrap:'wrap'}}>
            {reportFilterTabs.map(([key, label]) => {
              const count = key === 'all' ? reports.length : (reportCounts[key] || 0);
              const active = reportFilter === key;
              return (
                <button key={key} className={`chip${active ? ' active' : ''}`}
                  onClick={() => setReportFilter(key)}
                  style={{fontSize:11.5}}>
                  {label} <span style={{opacity:0.7, marginLeft:4}}>{count}</span>
                </button>
              );
            })}
          </div>
          {filteredReports.length === 0 ? (
            <div style={{padding:'40px 0', textAlign:'center', color:'var(--ink-mute)', fontFamily:'var(--f-mono)', fontSize:11.5}}>
              {reportFilter === 'open' ? '미처리 신고가 없습니다.' : '해당 상태의 신고가 없습니다.'}
            </div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'120px 1fr 220px 100px 200px', gap:16, padding:'10px 0', borderBottom:'1px solid var(--rule)'}}>
              {['DATE', 'POST · REASON', 'REPORTER · DETAIL', 'STATUS', 'ACTIONS'].map(h => (
                <span key={h} className="label" style={{fontSize:10}}>{h}</span>
              ))}
            </div>
          )}
          {filteredReports.map(r => {
            const meta = reportStatusMeta[r.status] || reportStatusMeta.open;
            const busy = reportBusyId === r.id;
            const dt = r.createdAt ? new Date(r.createdAt) : null;
            const dateStr = dt && !Number.isNaN(dt.getTime())
              ? `${String(dt.getMonth()+1).padStart(2,'0')}·${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
              : '—';
            return (
              <div key={r.id} style={{
                display:'grid', gridTemplateColumns:'120px 1fr 220px 100px 200px',
                gap:16, padding:'14px 0', borderBottom:'1px solid var(--rule-ghost)',
                alignItems:'start',
                opacity: busy ? 0.5 : 1,
              }}>
                <div style={{fontFamily:'var(--f-mono)', fontSize:11, color:'var(--ink-soft)', fontVariantNumeric:'tabular-nums'}}>
                  {dateStr}
                </div>
                <div style={{minWidth:0}}>
                  <div style={{display:'flex', alignItems:'baseline', gap:6, minWidth:0}}>
                    <span style={{fontFamily:'var(--f-kr-serif)', fontWeight:600, fontSize:14, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0}}>
                      {r.postTitle || '(삭제된 글)'}
                    </span>
                    {r.postStatus === 'hidden' && (
                      <span className="chip" style={{fontSize:9.5, padding:'2px 6px', flexShrink:0, color:'var(--ink-faint)', borderColor:'var(--rule)'}}>숨김</span>
                    )}
                  </div>
                  <div className="meta" style={{fontSize:11, marginTop:4, color:'var(--accent)'}}>
                    사유 · {r.reason}
                  </div>
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontFamily:'var(--f-mono)', fontSize:11, color:'var(--ink-soft)'}}>
                    @{r.reporter}
                  </div>
                  {r.detail && (
                    <div style={{fontSize:11.5, color:'var(--ink-mute)', marginTop:4, lineHeight:1.5,
                      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
                      "{r.detail}"
                    </div>
                  )}
                </div>
                <div>
                  <span className="status-chip" style={{borderColor:meta.color, color:meta.color}}>● {meta.label}</span>
                </div>
                <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                  {r.status !== 'reviewing' && r.status !== 'resolved' && r.status !== 'dismissed' && (
                    <button className="btn sm ghost" disabled={busy}
                      style={{padding:'5px 10px', fontSize:10}}
                      onClick={() => handleReportStatus(r, 'reviewing')}>검토</button>
                  )}
                  {r.status !== 'resolved' && (
                    <button className="btn sm ghost" disabled={busy}
                      style={{padding:'5px 10px', fontSize:10, color:'var(--accent)', borderColor:'var(--accent)'}}
                      onClick={() => handleReportStatus(r, 'resolved')}>처리</button>
                  )}
                  {r.status !== 'dismissed' && r.status !== 'resolved' && (
                    <button className="btn sm ghost" disabled={busy}
                      style={{padding:'5px 10px', fontSize:10}}
                      onClick={() => handleReportStatus(r, 'dismissed')}>반려</button>
                  )}
                  {(r.status === 'resolved' || r.status === 'dismissed') && (
                    <button className="btn sm ghost" disabled={busy}
                      style={{padding:'5px 10px', fontSize:10}}
                      onClick={() => handleReportStatus(r, 'open')}>재오픈</button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
};
