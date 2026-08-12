'use client';
import React, { useState, useRef, useMemo } from 'react';
import { Target, Sparkles, Bot, Send, Loader2, ChevronRight, ChevronLeft, Rocket, X, User, Flame, Trophy, Search, Wand2, Trash2, Star } from 'lucide-react';

const G = {
  textMain: '#F5F3FF',
  textMuted: '#B8AEDC',
  blue: '#6C7BFF',
  purple: '#A855F7',
  cardBg: 'rgba(255,255,255,0.06)',
  cardBorder: 'rgba(255,255,255,0.14)',
};

async function callClaude(messages, system) {
  // Calls our own /api/chat route (same origin) — the Anthropic key never
  // reaches this file or the browser at all. See app/api/chat/route.js.
  let res;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, messages }),
    });
  } catch (e) {
    throw new Error('Network request failed — ' + e.message);
  }
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('Bad response from the server'); }
  if (!res.ok || data?.error) {
    const raw = data?.error?.message || data?.error || `Request failed (${res.status})`;
    const rawStr = typeof raw === 'string' ? raw : JSON.stringify(raw);
    if (/exceeded_limit|rate_limit|overloaded/i.test(rawStr)) {
      let resetText = '';
      const m = rawStr.match(/"resets_?[Aa]t"\s*:\s*(\d+)/);
      if (m) {
        const d = new Date(parseInt(m[1], 10) * 1000);
        resetText = ` It should reset around ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
      }
      throw new Error(`The AI service is at capacity right now.${resetText} Try again shortly.`);
    }
    throw new Error(rawStr);
  }
  return (data?.content || []).map((b) => b.text || "").join("");
}

function parseJSON(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(cleaned); } catch (e) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e2) { return null; } }
    return null;
  }
}

const QUIZ_SYSTEM = `You are Dreamr Bot, an Akinator-style career discovery game inside the DREAMR app. Ask fun, conversational questions — never like a boring survey. Ask exactly one question at a time, adapting to prior answers, covering a broad mix of: interests, personality, work preferences, creativity, leadership, problem solving, social interaction, technology, physical activity, risk tolerance, desired lifestyle, general strengths. Give exactly 4 short punchy answer options (2-5 words each), each prefixed with one relevant emoji. After at most 15 questions, or sooner if a clear picture has emerged, stop and signal done. Output ONLY valid JSON, no prose, no markdown fences.
While asking: {"done": false, "question": string, "options": [string,string,string,string]}
When finished: {"done": true}`;

const MATCH_SYSTEM = `You are DREAMR's career matching engine. Given a person's quiz answers, return the strongest real career matches. Output ONLY valid JSON, no prose, no fences:
{"topMatches": [{"title": string, "matchPercent": number, "reasoning": string}]}
Return exactly 3 topMatches ordered by matchPercent descending, each reasoning one short sentence explaining why it fits their specific answers.`;

const ROADMAP_SYSTEM = `You are DREAMR's roadmap engine. Given a target dream or career (and optionally a constraint or modification request), build a personalized phased roadmap. Output ONLY valid JSON, no prose, no fences, in this exact shape:
{"dreamTitle": string, "description": string, "phases": [{"name": "Now", "items": [{"title": string, "what": string, "why": string, "how": string, "deadline": string}, {"title": string, "what": string, "why": string, "how": string, "deadline": string}]}, {"name": "Next Few Months", "items": [ ...2 items same shape... ]}, {"name": "1-Year Goals", "items": [ ...2 items... ]}, {"name": "Long-Term", "items": [ ...2 items... ]}], "nextStep": string, "requiredSkills": [string,string,string], "education": string}
Exactly 4 phases, exactly 2 items each (8 total). description is one short sentence for a card preview. Keep what/why/how to one short clause each, deadline very short (e.g. "This week", "Month 2"). If a constraint or modification request is given, rebuild the whole roadmap around it (e.g. no college, target salary, remote work, a specific location). Be concrete, not generic.`;

const DREAM_AI_SYSTEM = `You are Dream AI, an encouraging, concise personal coach inside the DREAMR app. If the user is stating a new dream or goal for the first time, reply with 2-3 short encouraging sentences confirming you understand and that you'll break it into steps. Do not include the roadmap itself. If they're asking a follow-up question or requesting a change to an existing roadmap (context will be provided), acknowledge the change in 1-2 short sentences. Plain conversational text only, no JSON, no markdown.`;

const EXPLORER_SYSTEM = `You are DREAMR's Career Explorer. Given a career name, return a profile of it. Output ONLY valid JSON, no prose, no fences:
{"title": string, "education": string, "workStyle": string, "salary": string, "whatYouDo": string, "skills": [string,string,string], "relatedCareers": [string,string,string], "pros": [string,string], "cons": [string,string]}
Keep every field to one short clause or sentence. salary should be a realistic estimated range, phrased as an estimate.`;

function seeded(seed, n) {
  let s = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) % 100000;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return Array.from({ length: n }, () => ({ x: rand() * 100, y: rand() * 100, r: 0.5 + rand() * 1.2, d: rand() * 4 }));
}

function Stars() {
  const stars = useMemo(() => seeded('galaxy', 55), []);
  return (
    <svg className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} preserveAspectRatio="none">
      {stars.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#fff"
          style={{ animation: `twinkle 3.5s ease-in-out ${s.d}s infinite`, opacity: 0.6 }} />
      ))}
    </svg>
  );
}

function GlassCard({ children, className = '', style = {}, onClick }) {
  return (
    <div onClick={onClick} className={`rounded-2xl backdrop-blur-md ${className}`}
      style={{ background: G.cardBg, border: `1px solid ${G.cardBorder}`, ...style }}>
      {children}
    </div>
  );
}

function GlowButton({ children, onClick, disabled, full, variant = 'solid' }) {
  const solid = variant === 'solid';
  return (
    <button onClick={onClick} disabled={disabled}
      className={`dreamr-btn flex items-center justify-center gap-2 px-5 py-3 rounded-xl ${full ? 'w-full' : ''}`}
      style={{
        background: solid ? `linear-gradient(135deg, ${G.blue}, ${G.purple})` : 'transparent',
        border: solid ? 'none' : `1.5px solid ${G.purple}88`,
        color: G.textMain,
        boxShadow: solid ? `0 0 24px -4px ${G.purple}99` : 'none',
        opacity: disabled ? 0.5 : 1,
        fontWeight: 600, fontSize: '0.9rem',
      }}>
      {children}
    </button>
  );
}

function ProgressBar({ pct, thin }) {
  return (
    <div className={`${thin ? 'h-1.5' : 'h-2.5'} rounded-full w-full`} style={{ background: 'rgba(255,255,255,0.1)' }}>
      <div className={`${thin ? 'h-1.5' : 'h-2.5'} rounded-full`} style={{
        width: `${pct}%`, transition: 'width 0.5s ease',
        background: `linear-gradient(90deg, ${G.blue}, ${G.purple})`,
        boxShadow: `0 0 12px -1px ${G.purple}aa`,
      }} />
    </div>
  );
}

function RobotMascot({ size = 72 }) {
  return (
    <div style={{ width: size, height: size, animation: 'bob 3s ease-in-out infinite' }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <linearGradient id="botGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={G.blue} />
            <stop offset="100%" stopColor={G.purple} />
          </linearGradient>
        </defs>
        <line x1="50" y1="14" x2="50" y2="4" stroke={G.purple} strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="4" r="4.5" fill={G.gold || '#F0B94D'} style={{ animation: 'twinkle 2s ease-in-out infinite' }} />
        <rect x="14" y="14" width="72" height="58" rx="24" fill="url(#botGrad)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
        <rect x="24" y="26" width="52" height="30" rx="14" fill="rgba(11,11,34,0.55)" />
        <g style={{ animation: 'blink 4s ease-in-out infinite' }}>
          <circle cx="39" cy="41" r="6" fill="#fff" />
          <circle cx="61" cy="41" r="6" fill="#fff" />
        </g>
        <path d="M 41 50 Q 50 56 59 50" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle cx="16" cy="43" r="5" fill="url(#botGrad)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <circle cx="84" cy="43" r="5" fill="url(#botGrad)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <rect x="32" y="76" width="36" height="16" rx="8" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <circle cx="50" cy="84" r="3" fill={G.gold || '#F0B94D'} />
      </svg>
    </div>
  );
}

function EmojiSilhouette({ text }) {
  const parts = text.split(' ');
  const lead = parts[0];
  const rest = parts.slice(1).join(' ');
  const isEmoji = /\p{Extended_Pictographic}/u.test(lead);
  if (!isEmoji) return <span>{text}</span>;
  return (
    <>
      <span style={{ filter: 'grayscale(1) brightness(0) invert(1)', opacity: 0.9, marginRight: 6 }}>{lead}</span>
      {rest}
    </>
  );
}

const ACHIEVEMENTS = [
  { key: 'first', label: 'First Step', icon: '🏆' },
  { key: 'goalsetter', label: 'Goal Setter', icon: '🎯' },
  { key: 'streak7', label: '7-Day Streak', icon: '🔥' },
  { key: 'chaser', label: 'Dream Chaser', icon: '🚀' },
  { key: 'hundred', label: '100 Goals', icon: '💎' },
];

function AchievementRow({ unlocked }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {ACHIEVEMENTS.map((a) => (
        <div key={a.key} className="flex flex-col items-center gap-1" style={{ opacity: unlocked[a.key] ? 1 : 0.3, width: 58 }}>
          <div style={{ fontSize: '1.3rem', filter: unlocked[a.key] ? `drop-shadow(0 0 6px ${G.purple})` : 'none' }}>{a.icon}</div>
          <span style={{ fontSize: '0.6rem', color: G.textMuted, textAlign: 'center' }}>{a.label}</span>
        </div>
      ))}
    </div>
  );
}

function flatItems(roadmap) { return roadmap.phases.flatMap((ph) => ph.items); }
function pctOf(roadmap, checked) {
  const total = flatItems(roadmap).length;
  const done = checked.flat().filter(Boolean).length;
  return total ? Math.round((done / total) * 100) : 0;
}

// ---------------- sheets ----------------

function ProfileSheet({ onClose, savedDreams, streak, completedGoalsTotal, unlocked }) {
  return (
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 20, background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl p-5 pb-8" style={{
        background: 'linear-gradient(180deg, #211048, #0B0B22)', border: `1px solid ${G.cardBorder}`, borderBottom: 'none', maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2"><User size={18} style={{ color: G.purple }} /><span style={{ color: G.textMain, fontFamily: 'Fraunces, serif', fontSize: '1.2rem' }}>Profile</span></div>
          <button onClick={onClose} className="dreamr-btn"><X size={20} color={G.textMuted} /></button>
        </div>

        <p style={{ fontSize: '0.65rem', color: G.textMuted, letterSpacing: '0.04em' }}>SAVED DREAMS</p>
        <p style={{ color: G.textMain, fontSize: '1rem', fontWeight: 600, marginTop: 4 }}>{savedDreams.length === 0 ? 'None yet' : `${savedDreams.length} saved`}</p>

        <div className="grid grid-cols-2 gap-3 my-3">
          <GlassCard className="p-3 flex items-center gap-2">
            <Flame size={18} style={{ color: '#FF8659' }} />
            <div><p style={{ color: G.textMain, fontWeight: 700, fontSize: '1.1rem' }}>{streak}</p><p style={{ color: G.textMuted, fontSize: '0.68rem' }}>Day streak</p></div>
          </GlassCard>
          <GlassCard className="p-3 flex items-center gap-2">
            <Trophy size={18} style={{ color: '#F0B94D' }} />
            <div><p style={{ color: G.textMain, fontWeight: 700, fontSize: '1.1rem' }}>{completedGoalsTotal}</p><p style={{ color: G.textMuted, fontSize: '0.68rem' }}>Goals done</p></div>
          </GlassCard>
        </div>

        <p style={{ color: G.textMuted, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 8 }}>ACHIEVEMENTS</p>
        <AchievementRow unlocked={unlocked} />

        <div className="mt-5 rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${G.blue}33, ${G.purple}33)`, border: `1px solid ${G.purple}55` }}>
          <p style={{ color: G.textMain, fontFamily: 'Fraunces, serif', fontSize: '1.05rem' }}>⭐ Dream Pro</p>
          <p style={{ color: G.textMuted, fontSize: '0.78rem', marginTop: 4 }}>Unlimited Dream AI, full roadmaps, What-If scenarios, advanced career matching &amp; explorer.</p>
          <p style={{ color: G.textMain, fontSize: '0.85rem', marginTop: 8, fontWeight: 600 }}>$7.99/mo · $39.99/yr</p>
          <p style={{ color: G.textMuted, fontSize: '0.68rem', marginTop: 6 }}>This demo has everything unlocked — no payment wired up.</p>
        </div>
      </div>
    </div>
  );
}

function ExplorerSheet({ onClose, query, setQuery, loading, result, error, onSearch, onBuild }) {
  return (
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 20, background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl p-5 pb-8" style={{
        background: 'linear-gradient(180deg, #211048, #0B0B22)', border: `1px solid ${G.cardBorder}`, borderBottom: 'none', maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2"><Search size={18} style={{ color: G.purple }} /><span style={{ color: G.textMain, fontFamily: 'Fraunces, serif', fontSize: '1.2rem' }}>Career Explorer</span></div>
          <button onClick={onClose} className="dreamr-btn"><X size={20} color={G.textMuted} /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="e.g. Nurse, Game Designer, Pilot"
            className="flex-1 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${G.cardBorder}`, color: G.textMain, outline: 'none' }} />
          <GlowButton onClick={onSearch} disabled={!query.trim() || loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : 'Go'}</GlowButton>
        </div>
        {loading && !result && <p className="flex items-center gap-2" style={{ color: G.textMuted, fontSize: '0.85rem' }}><Loader2 size={14} className="animate-spin" /> Looking it up...</p>}
        {!loading && error && !result && <p style={{ color: '#FF9E80', fontSize: '0.85rem' }}>{error} — try searching again.</p>}
        {result && (
          <div>
            <p style={{ color: G.textMain, fontFamily: 'Fraunces, serif', fontSize: '1.15rem' }}>{result.title}</p>
            <p style={{ color: G.textMuted, fontSize: '0.82rem', marginTop: 4 }}>{result.whatYouDo}</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <GlassCard className="p-3"><p style={{ fontSize: '0.62rem', color: G.textMuted }}>EDUCATION</p><p style={{ fontSize: '0.8rem', color: G.textMain, marginTop: 3 }}>{result.education}</p></GlassCard>
              <GlassCard className="p-3"><p style={{ fontSize: '0.62rem', color: G.textMuted }}>SALARY (EST.)</p><p style={{ fontSize: '0.8rem', color: G.textMain, marginTop: 3 }}>{result.salary}</p></GlassCard>
              <GlassCard className="p-3"><p style={{ fontSize: '0.62rem', color: G.textMuted }}>WORK STYLE</p><p style={{ fontSize: '0.8rem', color: G.textMain, marginTop: 3 }}>{result.workStyle}</p></GlassCard>
              <GlassCard className="p-3"><p style={{ fontSize: '0.62rem', color: G.textMuted }}>SKILLS</p><p style={{ fontSize: '0.8rem', color: G.textMain, marginTop: 3 }}>{(result.skills || []).join(', ')}</p></GlassCard>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <GlassCard className="p-3"><p style={{ fontSize: '0.62rem', color: G.textMuted }}>PROS</p>{(result.pros || []).map((p, i) => <p key={i} style={{ fontSize: '0.78rem', color: G.textMain, marginTop: 3 }}>+ {p}</p>)}</GlassCard>
              <GlassCard className="p-3"><p style={{ fontSize: '0.62rem', color: G.textMuted }}>CONS</p>{(result.cons || []).map((p, i) => <p key={i} style={{ fontSize: '0.78rem', color: G.textMain, marginTop: 3 }}>– {p}</p>)}</GlassCard>
            </div>
            <p style={{ fontSize: '0.68rem', color: G.textMuted, marginTop: 8 }}>Related: {(result.relatedCareers || []).join(', ')}</p>
            <div className="mt-4"><GlowButton full onClick={() => onBuild(result.title)}><Rocket size={15} /> BUILD MY ROADMAP</GlowButton></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- roadmap detail (shared) ----------------

function RoadmapPhases({ roadmap, checked, toggleCheck, expanded, setExpanded, readOnly }) {
  return (
    <>
      {roadmap.phases.map((phase, pi) => (
        <div key={pi} className="mb-3">
          <p style={{ color: G.purple, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.03em', marginBottom: 6 }}>{phase.name.toUpperCase()}</p>
          <div className="flex flex-col gap-2">
            {phase.items.map((item, ii) => {
              const isChecked = !readOnly && checked && checked[pi] && checked[pi][ii];
              const key = `${pi}-${ii}`;
              return (
                <GlassCard key={ii} className="p-3">
                  <div className="flex items-center gap-3">
                    {!readOnly && (
                      <button onClick={() => toggleCheck(pi, ii)} className="dreamr-btn flex items-center justify-center rounded-md flex-shrink-0"
                        style={{ width: 22, height: 22, background: isChecked ? `linear-gradient(135deg, ${G.blue}, ${G.purple})` : 'transparent', border: `1.5px solid ${isChecked ? 'transparent' : G.cardBorder}` }}>
                        {isChecked && <span style={{ color: '#fff', fontSize: '0.7rem' }}>✓</span>}
                      </button>
                    )}
                    <span onClick={() => setExpanded(expanded === key ? null : key)} style={{ color: G.textMain, fontSize: '0.87rem', flex: 1, textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1, cursor: 'pointer' }}>{item.title}</span>
                    <span style={{ fontSize: '0.65rem', color: G.textMuted, flexShrink: 0 }}>{item.deadline}</span>
                  </div>
                  {expanded === key && (
                    <div className="mt-2 pl-9 flex flex-col gap-1">
                      <p style={{ color: G.textMuted, fontSize: '0.78rem' }}><b style={{ color: G.textMain }}>What:</b> {item.what}</p>
                      <p style={{ color: G.textMuted, fontSize: '0.78rem' }}><b style={{ color: G.textMain }}>Why:</b> {item.why}</p>
                      <p style={{ color: G.textMuted, fontSize: '0.78rem' }}><b style={{ color: G.textMain }}>How:</b> {item.how}</p>
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

// ---------------- My Dream tab ----------------

function DreamCard({ dream, onOpen, onRemove, onToggle }) {
  const pct = pctOf(dream.roadmap, dream.checked);
  const items = flatItems(dream.roadmap);
  return (
    <GlassCard className="p-4 mb-3">
      <div className="flex items-start justify-between">
        <div>
          <p style={{ color: G.textMain, fontFamily: 'Fraunces, serif', fontSize: '1.05rem' }}>{dream.roadmap.dreamTitle}</p>
          <p style={{ color: G.textMuted, fontSize: '0.78rem', marginTop: 2 }}>{dream.roadmap.description}</p>
        </div>
        <button onClick={() => onRemove(dream.id)} className="dreamr-btn flex-shrink-0"><Trash2 size={15} color={G.textMuted} /></button>
      </div>
      <div className="flex justify-between mt-3 mb-1"><span style={{ color: G.textMain, fontSize: '0.75rem' }}>Progress</span><span style={{ color: G.purple, fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}>{pct}%</span></div>
      <ProgressBar pct={pct} thin />
      <div className="flex flex-col gap-1.5 mt-3">
        {items.map((it, flatIdx) => {
          let counter = 0, pi = 0, ii = 0;
          for (let p = 0; p < dream.roadmap.phases.length; p++) {
            for (let k = 0; k < dream.roadmap.phases[p].items.length; k++) {
              if (counter === flatIdx) { pi = p; ii = k; }
              counter++;
            }
          }
          const isChecked = dream.checked[pi] && dream.checked[pi][ii];
          return (
            <div key={flatIdx} className="flex items-center gap-2" onClick={() => onToggle(dream.id, pi, ii)} style={{ cursor: 'pointer' }}>
              <span style={{ fontSize: '0.85rem' }}>{isChecked ? '☑' : '☐'}</span>
              <span style={{ color: G.textMain, fontSize: '0.82rem', textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.55 : 1 }}>{it.title}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 p-2.5 rounded-lg flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <Target size={13} style={{ color: G.purple }} /><span style={{ color: G.textMain, fontSize: '0.78rem' }}>{dream.roadmap.nextStep}</span>
      </div>
      <button onClick={() => onOpen(dream.id)} className="dreamr-btn flex items-center gap-1 mt-3 text-sm" style={{ color: G.blue, fontWeight: 600 }}>
        Open full roadmap <ChevronRight size={14} />
      </button>
    </GlassCard>
  );
}

function MyDreamPanel({ savedDreams, onOpen, onRemove, onToggle, onEmptyCTA, openDreamId, onBack, expanded, setExpanded, whatIf, setWhatIf, whatIfLoading, whatIfError, onWhatIf, streak, onCheckIn }) {
  const openDream = savedDreams.find((d) => d.id === openDreamId);

  if (savedDreams.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <Target size={40} style={{ color: G.purple, opacity: 0.8 }} />
        <p className="mt-4" style={{ fontFamily: 'Fraunces, serif', fontSize: '1.3rem', color: G.textMain }}>No dreams saved yet</p>
        <p className="mt-2" style={{ color: G.textMuted, fontSize: '0.88rem' }}>Build a roadmap in Dream AI, then save it here to track it.</p>
        <div className="mt-5"><GlowButton onClick={onEmptyCTA}>Go to Dream AI <ChevronRight size={16} /></GlowButton></div>
      </div>
    );
  }

  if (openDream) {
    const pct = pctOf(openDream.roadmap, openDream.checked);
    return (
      <div className="h-full overflow-y-auto px-5 pt-14 pb-4">
        <button onClick={onBack} className="dreamr-btn flex items-center gap-1 mb-3 text-sm" style={{ color: G.textMuted }}><ChevronLeft size={15} /> All dreams</button>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.5rem', color: G.textMain }}>{openDream.roadmap.dreamTitle}</h1>
        <p style={{ color: G.textMuted, fontSize: '0.85rem', marginTop: 4 }}>{openDream.roadmap.description}</p>

        <GlassCard className="p-4 mt-4">
          <div className="flex justify-between mb-1.5"><span style={{ color: G.textMain, fontSize: '0.8rem', fontWeight: 600 }}>Dream Progress</span><span style={{ color: G.purple, fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace' }}>{pct}%</span></div>
          <ProgressBar pct={pct} />
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1.5"><Flame size={15} style={{ color: '#FF8659' }} /><span style={{ color: G.textMain, fontSize: '0.82rem' }}>{streak} day streak</span></div>
            <button onClick={onCheckIn} className="dreamr-btn px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)', color: G.textMain, fontSize: '0.72rem' }}>I made progress today</button>
          </div>
        </GlassCard>

        <p className="mt-5 mb-2" style={{ color: G.textMuted, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em' }}>FULL ROADMAP</p>
        <RoadmapPhases roadmap={openDream.roadmap} checked={openDream.checked} toggleCheck={(pi, ii) => onToggle(openDream.id, pi, ii)} expanded={expanded} setExpanded={setExpanded} />

        <div className="grid grid-cols-2 gap-3 mt-2">
          <GlassCard className="p-3"><p style={{ fontSize: '0.65rem', color: G.textMuted }}>SKILLS</p><p style={{ fontSize: '0.8rem', color: G.textMain, marginTop: 4 }}>{(openDream.roadmap.requiredSkills || []).join(', ')}</p></GlassCard>
          <GlassCard className="p-3"><p style={{ fontSize: '0.65rem', color: G.textMuted }}>EDUCATION</p><p style={{ fontSize: '0.8rem', color: G.textMain, marginTop: 4 }}>{openDream.roadmap.education}</p></GlassCard>
        </div>

        <p className="mt-5 mb-2" style={{ color: G.textMuted, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em' }}>WHAT IF...?</p>
        <GlassCard className="p-3">
          <div className="flex gap-2">
            <input value={whatIf} onChange={(e) => setWhatIf(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && whatIf.trim() && onWhatIf(openDream.id)}
              placeholder="I don't want to go to college..."
              className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${G.cardBorder}`, color: G.textMain, outline: 'none' }} />
            <button onClick={() => onWhatIf(openDream.id)} disabled={!whatIf.trim() || whatIfLoading} className="dreamr-btn flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 40, background: `linear-gradient(135deg, ${G.blue}, ${G.purple})`, opacity: !whatIf.trim() ? 0.5 : 1 }}>
              {whatIfLoading ? <Loader2 size={15} className="animate-spin" color="#fff" /> : <Wand2 size={15} color="#fff" />}
            </button>
          </div>
          <p style={{ fontSize: '0.65rem', color: G.textMuted, marginTop: 6 }}>Rebuilding will reset this dream's checklist progress.</p>
          {whatIfError && <p style={{ fontSize: '0.75rem', color: '#FF9E80', marginTop: 6 }}>{whatIfError}</p>}
        </GlassCard>
        <div style={{ height: 12 }} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-5 pt-14 pb-4">
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: G.textMuted, letterSpacing: '0.08em' }}>MY DREAMS</p>
      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.5rem', color: G.textMain, marginTop: 4, marginBottom: 14 }}>🌙 {savedDreams.length} saved</h1>
      {savedDreams.map((d) => <DreamCard key={d.id} dream={d} onOpen={onOpen} onRemove={onRemove} onToggle={onToggle} />)}
      <button onClick={onEmptyCTA} className="dreamr-btn flex items-center gap-1 text-sm mt-1" style={{ color: G.blue, fontWeight: 600 }}><Sparkles size={14} /> Build another dream</button>
      <div style={{ height: 12 }} />
    </div>
  );
}

// ---------------- Dream AI tab ----------------

function DreamAIPanel({ chat, sendChat, chatLoading, draftRoadmap, draftLoading, onSave, draft, setDraft, onKnowDream, onDontKnow, showKnowInput, knownDream, setKnownDream, onOpenExplorer, expanded, setExpanded }) {
  const bottomRef = useRef(null);
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.length, draftRoadmap, draftLoading]);
  return (
    <div className="h-full flex flex-col px-5 pt-14 pb-3">
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: G.textMuted, letterSpacing: '0.08em' }}>WHAT'S YOUR DREAM?</p>
      <div className="flex items-center gap-2 mt-1">
        <Sparkles size={20} style={{ color: G.purple }} />
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.4rem', color: G.textMain }}>Dream AI</h1>
      </div>

      {chat.length === 0 && !draftRoadmap && (
        <div className="mt-4 flex flex-col gap-2">
          <GlowButton full onClick={onKnowDream}>🎯 I KNOW MY DREAM</GlowButton>
          <GlowButton full variant="outline" onClick={onDontKnow}>🧭 I DON'T KNOW YET</GlowButton>
          {showKnowInput && (
            <div className="flex gap-2 mt-1">
              <input value={knownDream} onChange={(e) => setKnownDream(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && knownDream.trim() && sendChat(knownDream)}
                placeholder="I want to become..." autoFocus
                className="flex-1 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${G.cardBorder}`, color: G.textMain, outline: 'none' }} />
              <button onClick={() => sendChat(knownDream)} disabled={!knownDream.trim()} className="dreamr-btn flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 44, background: `linear-gradient(135deg, ${G.blue}, ${G.purple})` }}>
                <Send size={17} color="#fff" />
              </button>
            </div>
          )}
          <button onClick={onOpenExplorer} className="dreamr-btn flex items-center gap-1 justify-center mt-1 text-sm" style={{ color: G.textMuted }}>
            <Search size={14} /> Explore careers without the quiz
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto mt-4 flex flex-col gap-3 pr-1">
        {chat.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <GlassCard className="p-3" style={{ maxWidth: '85%', background: m.role === 'user' ? `linear-gradient(135deg, ${G.blue}55, ${G.purple}55)` : G.cardBg }}>
              <p style={{ color: G.textMain, fontSize: '0.87rem' }}>{m.content}</p>
            </GlassCard>
          </div>
        ))}
        {chatLoading && <div className="flex items-center gap-2" style={{ color: G.textMuted, fontSize: '0.82rem' }}><Loader2 size={14} className="animate-spin" /> Dream AI is thinking...</div>}
        {draftLoading && <div className="flex items-center gap-2" style={{ color: G.textMuted, fontSize: '0.82rem' }}><Loader2 size={14} className="animate-spin" /> Building your roadmap...</div>}

        {draftRoadmap && !draftLoading && (
          <GlassCard className="p-4" style={{ borderColor: `${G.purple}55` }}>
            <p style={{ color: G.textMain, fontFamily: 'Fraunces, serif', fontSize: '1.1rem' }}>{draftRoadmap.dreamTitle}</p>
            <p style={{ color: G.textMuted, fontSize: '0.8rem', marginTop: 2 }}>{draftRoadmap.description}</p>
            <div className="mt-3">
              <RoadmapPhases roadmap={draftRoadmap} readOnly expanded={expanded} setExpanded={setExpanded} />
            </div>
            <div className="mt-1"><GlowButton full onClick={onSave}><Star size={15} /> SAVE TO MY DREAMS</GlowButton></div>
            <p style={{ fontSize: '0.68rem', color: G.textMuted, marginTop: 8 }}>Ask below to tweak it first — e.g. "what if I don't want to go to college?"</p>
          </GlassCard>
        )}
        <div ref={bottomRef} />
      </div>

      {(chat.length > 0 || draftRoadmap) && (
        <div className="flex items-center gap-2 mt-3">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) sendChat(draft); }}
            placeholder="Ask Dream AI anything"
            className="flex-1 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${G.cardBorder}`, color: G.textMain, outline: 'none' }} />
          <button onClick={() => sendChat(draft)} disabled={!draft.trim() || chatLoading} className="dreamr-btn flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 44, height: 44, background: `linear-gradient(135deg, ${G.blue}, ${G.purple})`, opacity: !draft.trim() ? 0.5 : 1 }}>
            <Send size={17} color="#fff" />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------- Dreamr Bot tab ----------------

function DreamerBotPanel({ quizQuestion, quizOptions, quizCount, quizLoading, quizError, answerQuiz, matches, matchLoading, matchError, retryMatches, buildFromMatch, exploreFromMatch, startQuiz, quizStarted }) {
  if (!quizStarted) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <RobotMascot size={76} />
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.4rem', color: G.textMain, marginTop: 12 }}>Dreamr Bot</h1>
        <p className="mt-2" style={{ color: G.textMuted, fontSize: '0.88rem' }}>Don't know what career you want? Let's play a game and figure it out.</p>
        {quizError && <p className="mt-3" style={{ color: '#FF9E80', fontSize: '0.82rem' }}>{quizError}</p>}
        <div className="mt-5"><GlowButton onClick={startQuiz}>{quizError ? 'TRY AGAIN' : 'START'}</GlowButton></div>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto px-5 pt-14 pb-4">
      <div className="flex items-center gap-2"><Bot size={18} style={{ color: G.blue }} /><h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', color: G.textMain }}>Dreamr Bot</h1></div>

      {!matches && (
        <>
          <p className="mt-4" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: G.textMuted }}>QUESTION {Math.min(quizCount + 1, 15)} / 15</p>
          <div className="mt-1"><ProgressBar pct={Math.min((quizCount / 15) * 100, 100)} /></div>
          {quizLoading && !quizQuestion && (
            <div className="mt-6 flex flex-col items-center text-center">
              <RobotMascot size={56} />
              <p className="mt-3 flex items-center gap-2" style={{ color: G.textMuted, fontSize: '0.85rem' }}><Loader2 size={14} className="animate-spin" /> Thinking...</p>
            </div>
          )}
          {quizQuestion && (
            <div className="mt-5">
              <div className="flex items-start gap-3">
                <RobotMascot size={48} />
                <GlassCard className="p-3 flex-1" style={{ borderColor: `${G.purple}55` }}>
                  <p style={{ color: G.textMain, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '1.12rem', lineHeight: 1.35 }}>{quizQuestion}</p>
                </GlassCard>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {quizOptions.map((opt, i) => (
                  <button key={i} onClick={() => answerQuiz(opt)} disabled={quizLoading} className="dreamr-btn text-left px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${i % 2 === 0 ? G.purple : G.blue}66`, color: G.textMain, fontSize: '0.88rem', opacity: quizLoading ? 0.6 : 1 }}>
                    <EmojiSilhouette text={opt} />
                  </button>
                ))}
              </div>
              {quizError && <p className="mt-3" style={{ color: '#FF9E80', fontSize: '0.8rem' }}>{quizError}</p>}
            </div>
          )}
        </>
      )}

      {matchLoading && (
        <div className="mt-6 flex flex-col items-center text-center">
          <RobotMascot size={56} />
          <p className="mt-3 flex items-center gap-2" style={{ color: G.textMuted, fontSize: '0.85rem' }}><Loader2 size={14} className="animate-spin" /> Scoring your matches...</p>
        </div>
      )}
      {!matchLoading && matchError && !matches && (
        <div className="mt-6 flex flex-col items-center text-center">
          <p style={{ color: '#FF9E80', fontSize: '0.85rem' }}>{matchError}</p>
          <div className="mt-4"><GlowButton onClick={retryMatches}>TRY AGAIN</GlowButton></div>
        </div>
      )}

      {matches && (
        <div className="mt-5">
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.1rem', color: G.textMain }}>🎯 YOUR RESULTS</p>
          <div className="flex flex-col gap-2 mt-4">
            {matches.topMatches.map((m, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
              return (
                <GlassCard key={i} className="p-4">
                  <div className="flex items-center justify-between">
                    <span style={{ color: G.textMain, fontWeight: 600, fontSize: '0.92rem' }}>{medal} {m.title}</span>
                    <span style={{ color: G.purple, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>{m.matchPercent}% match</span>
                  </div>
                  <p className="mt-1" style={{ color: G.textMuted, fontSize: '0.8rem' }}>{m.reasoning}</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => exploreFromMatch(m.title)} className="dreamr-btn flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs"
                      style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${G.cardBorder}`, color: G.textMain, fontWeight: 600 }}>
                      <Search size={13} /> EXPLORE
                    </button>
                    <button onClick={() => buildFromMatch(m.title)} className="dreamr-btn flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs"
                      style={{ background: `linear-gradient(135deg, ${G.blue}, ${G.purple})`, color: '#fff', fontWeight: 600 }}>
                      <Rocket size={13} /> BUILD ROADMAP
                    </button>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- app ----------------

export default function App() {
  const [active, setActive] = useState(1);
  const dragState = useRef({ startX: 0, dragging: false, offset: 0 });
  const [dragPx, setDragPx] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);

  const [savedDreams, setSavedDreams] = useState([]);
  const [openDreamId, setOpenDreamId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [whatIf, setWhatIf] = useState('');
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [whatIfError, setWhatIfError] = useState('');

  const [streak, setStreak] = useState(0);
  const [bonusGoals, setBonusGoals] = useState(0);

  const [chat, setChat] = useState([]);
  const [draft, setDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [draftRoadmap, setDraftRoadmap] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftTarget, setDraftTarget] = useState('');
  const [pendingGoal, setPendingGoal] = useState('');
  const [showKnowInput, setShowKnowInput] = useState(false);
  const [knownDream, setKnownDream] = useState('');

  const [quizStarted, setQuizStarted] = useState(false);
  const [quizMessages, setQuizMessages] = useState([]);
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [quizOptions, setQuizOptions] = useState([]);
  const [quizCount, setQuizCount] = useState(0);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [qaPairs, setQaPairs] = useState([]);
  const [lastQA, setLastQA] = useState([]);
  const [matches, setMatches] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState('');

  const [explorerQuery, setExplorerQuery] = useState('');
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerError, setExplorerError] = useState('');
  const [explorerResult, setExplorerResult] = useState(null);

  function toggleSavedCheck(dreamId, pi, ii) {
    setSavedDreams((ds) => ds.map((d) => {
      if (d.id !== dreamId) return d;
      const next = d.checked.map((arr) => arr.slice());
      next[pi][ii] = !next[pi][ii];
      return { ...d, checked: next };
    }));
  }

  function onCheckIn() { setStreak((s) => s + 1); setBonusGoals((b) => b + 1); }

  function removeDream(id) {
    setSavedDreams((ds) => ds.filter((d) => d.id !== id));
    if (openDreamId === id) setOpenDreamId(null);
  }

  async function generateDraft(target, contextNote) {
    setActive(1);
    setDraftLoading(true);
    setDraftTarget(target);
    try {
      const content = `Target dream/career: ${target}\nContext: ${contextNote}`;
      const text = await callClaude([{ role: 'user', content }], ROADMAP_SYSTEM);
      const parsed = parseJSON(text);
      if (!parsed) throw new Error('bad json');
      setDraftRoadmap(parsed);
    } catch (e) {
      setChat((c) => [...c, { role: 'assistant', content: `I couldn't build that roadmap — ${e.message}` }]);
    } finally {
      setDraftLoading(false);
      setShowKnowInput(false);
    }
  }

  function saveDraft() {
    if (!draftRoadmap) return;
    const newDream = { id: Date.now(), roadmap: draftRoadmap, checked: draftRoadmap.phases.map((ph) => new Array(ph.items.length).fill(false)) };
    setSavedDreams((ds) => [...ds, newDream]);
    setDraftRoadmap(null);
    setChat([]);
    setPendingGoal('');
    setActive(0);
  }

  async function sendChat(msgText) {
    const userMsg = (msgText || draft).trim();
    if (!userMsg || chatLoading || draftLoading) return;
    setDraft(''); setKnownDream('');
    setChat((c) => [...c, { role: 'user', content: userMsg }]);
    setChatLoading(true);
    try {
      if (draftRoadmap) {
        const ackContent = `Current roadmap context:\n${JSON.stringify(draftRoadmap)}\n\nUser request: ${userMsg}`;
        const ack = await callClaude([{ role: 'user', content: ackContent }], DREAM_AI_SYSTEM);
        setChat((c) => [...c, { role: 'assistant', content: ack.trim() }]);
        setChatLoading(false);
        setDraftLoading(true);
        const rmContent = `Target dream/career: ${draftTarget}\nContext: adjust the existing roadmap per this request: "${userMsg}". Original roadmap: ${JSON.stringify(draftRoadmap)}`;
        const text = await callClaude([{ role: 'user', content: rmContent }], ROADMAP_SYSTEM);
        const parsed = parseJSON(text);
        if (parsed) setDraftRoadmap(parsed);
        setDraftLoading(false);
      } else {
        const text = await callClaude([{ role: 'user', content: userMsg }], DREAM_AI_SYSTEM);
        setChat((c) => [...c, { role: 'assistant', content: text.trim() }]);
        setPendingGoal(userMsg);
        generateDraft(userMsg, 'stated directly by the user via Dream AI chat');
        setChatLoading(false);
      }
    } catch (e) {
      setChat((c) => [...c, { role: 'assistant', content: `Something went wrong — ${e.message}` }]);
      setChatLoading(false); setDraftLoading(false);
    }
  }

  function buildFromMatch(title) { generateDraft(title, 'from Dreamr Bot discovery quiz'); }
  function exploreFromMatch(title) { setExplorerQuery(title); setShowExplorer(true); runExplorerSearch(title); }

  async function onWhatIf(dreamId) {
    const dream = savedDreams.find((d) => d.id === dreamId);
    if (!whatIf.trim() || !dream) return;
    setWhatIfLoading(true); setWhatIfError('');
    try {
      const content = `Target dream/career: ${dream.roadmap.dreamTitle}\nContext: rebuilding existing roadmap with a new constraint: "${whatIf.trim()}"`;
      const text = await callClaude([{ role: 'user', content }], ROADMAP_SYSTEM);
      const parsed = parseJSON(text);
      if (!parsed) throw new Error('bad json');
      setSavedDreams((ds) => ds.map((d) => d.id === dreamId ? { ...d, roadmap: parsed, checked: parsed.phases.map((ph) => new Array(ph.items.length).fill(false)) } : d));
      setWhatIf('');
    } catch (e) { setWhatIfError(e.message); } finally { setWhatIfLoading(false); }
  }

  async function startQuiz() {
    setQuizStarted(true); setQuizLoading(true); setQuizCount(0); setQaPairs([]); setMatches(null); setQuizError('');
    const msgs = [{ role: 'user', content: 'Begin the discovery game.' }];
    try {
      const text = await callClaude(msgs, QUIZ_SYSTEM);
      const parsed = parseJSON(text);
      if (!parsed) throw new Error('bad json');
      setQuizMessages([...msgs, { role: 'assistant', content: text }]);
      applyQuizStep(parsed, []);
    } catch (e) {
      setQuizStarted(false); setQuizQuestion(null); setQuizOptions([]);
      setQuizError(e.message);
    } finally { setQuizLoading(false); }
  }

  function applyQuizStep(parsed, currentQA) {
    if (parsed.done) { setQuizQuestion(null); setQuizOptions([]); generateMatches(currentQA); }
    else { setQuizQuestion(parsed.question); setQuizOptions(parsed.options || []); }
  }

  async function answerQuiz(opt) {
    if (quizLoading) return;
    setQuizLoading(true); setQuizError('');
    const nextCount = quizCount + 1;
    const hint = nextCount >= 15 ? ' [Enough signal — mark done now.]' : '';
    const msgs = [...quizMessages, { role: 'user', content: opt + hint }];
    const newQA = [...qaPairs, { q: quizQuestion, a: opt }];
    try {
      const text = await callClaude(msgs, QUIZ_SYSTEM);
      const parsed = parseJSON(text);
      if (!parsed) throw new Error('bad json');
      setQuizMessages([...msgs, { role: 'assistant', content: text }]);
      setQaPairs(newQA); setQuizCount(nextCount); applyQuizStep(parsed, newQA);
    } catch (e) { setQuizError(e.message); } finally { setQuizLoading(false); }
  }

  async function generateMatches(qa) {
    setMatchLoading(true); setMatchError(''); setLastQA(qa);
    const qaText = qa.map((p, i) => `${i + 1}. ${p.q} -> ${p.a}`).join('\n');
    try {
      const text = await callClaude([{ role: 'user', content: `Quiz answers:\n${qaText}` }], MATCH_SYSTEM);
      const parsed = parseJSON(text);
      if (!parsed) throw new Error('bad json');
      setMatches(parsed);
    } catch (e) { setMatchError(e.message); } finally { setMatchLoading(false); }
  }

  function retryMatches() { generateMatches(lastQA); }

  async function runExplorerSearch(q) {
    const term = (q || explorerQuery).trim();
    if (!term) return;
    setExplorerLoading(true); setExplorerResult(null); setExplorerError('');
    try {
      const text = await callClaude([{ role: 'user', content: term }], EXPLORER_SYSTEM);
      const parsed = parseJSON(text);
      if (!parsed) throw new Error('bad json');
      setExplorerResult(parsed);
    } catch (e) { setExplorerError(e.message); } finally { setExplorerLoading(false); }
  }

  function buildFromExplorer(title) { setShowExplorer(false); generateDraft(title, 'chosen from Career Explorer'); }

  function onPointerDown(e) { dragState.current = { startX: e.clientX, dragging: true, offset: 0 }; }
  function onPointerMove(e) { if (!dragState.current.dragging) return; const dx = e.clientX - dragState.current.startX; dragState.current.offset = dx; setDragPx(dx); }
  function onPointerUp() {
    if (!dragState.current.dragging) return;
    const dx = dragState.current.offset; dragState.current.dragging = false;
    if (dx < -60 && active < 2) setActive(active + 1); else if (dx > 60 && active > 0) setActive(active - 1);
    setDragPx(0);
  }

  const translate = `calc(-${active * 100}% + ${dragPx}px)`;
  const navItems = [{ icon: Target, label: 'My Dream' }, { icon: Sparkles, label: 'Dream AI' }, { icon: Bot, label: 'Dreamr Bot' }];

  const completedGoalsTotal = savedDreams.reduce((sum, d) => sum + d.checked.flat().filter(Boolean).length, 0) + bonusGoals;
  const phaseFullyDone = savedDreams.some((d) => d.checked.some((arr) => arr.length > 0 && arr.every(Boolean)));
  const unlocked = {
    first: completedGoalsTotal >= 1,
    goalsetter: savedDreams.length > 0,
    streak7: streak >= 7,
    chaser: phaseFullyDone,
    hundred: completedGoalsTotal >= 100,
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden" style={{
      background: 'radial-gradient(ellipse at 30% 0%, #2E1065 0%, #1B1035 45%, #0B0B22 100%)', fontFamily: 'Inter, sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Playfair+Display:ital@1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes twinkle { 0%,100% { opacity: 0.25; } 50% { opacity: 0.85; } }
        @keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes blink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.15); } }
        .dreamr-btn { transition: transform 0.15s ease, opacity 0.15s ease; cursor: pointer; }
        .dreamr-btn:hover { transform: translateY(-1px); }
        .dreamr-btn:focus-visible { outline: 2px solid ${G.blue}; outline-offset: 2px; }
        input::placeholder { color: ${G.textMuted}; }
      `}</style>
      <Stars />

      <button onClick={() => setShowProfile(true)} className="dreamr-btn fixed flex items-center justify-center rounded-full" style={{
        top: 16, right: 16, width: 38, height: 38, zIndex: 10, background: G.cardBg, border: `1px solid ${G.cardBorder}`, backdropFilter: 'blur(10px)',
      }}>
        <User size={17} color={G.textMain} />
      </button>

      <div className="relative w-full h-full flex flex-col" style={{ zIndex: 1 }}>
        <div className="flex-1 flex select-none"
          style={{ transform: `translateX(${translate})`, transition: dragPx === 0 ? 'transform 0.3s ease' : 'none', touchAction: 'pan-y' }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
          <div style={{ width: '100%' }} className="h-full flex-shrink-0">
            <MyDreamPanel savedDreams={savedDreams} onOpen={setOpenDreamId} onRemove={removeDream} onToggle={toggleSavedCheck}
              onEmptyCTA={() => setActive(1)} openDreamId={openDreamId} onBack={() => setOpenDreamId(null)} expanded={expanded} setExpanded={setExpanded}
              whatIf={whatIf} setWhatIf={setWhatIf} whatIfLoading={whatIfLoading} whatIfError={whatIfError} onWhatIf={onWhatIf} streak={streak} onCheckIn={onCheckIn} />
          </div>
          <div style={{ width: '100%' }} className="h-full flex-shrink-0">
            <DreamAIPanel chat={chat} sendChat={sendChat} chatLoading={chatLoading} draftRoadmap={draftRoadmap} draftLoading={draftLoading}
              onSave={saveDraft} draft={draft} setDraft={setDraft} onKnowDream={() => setShowKnowInput(true)} onDontKnow={() => setActive(2)}
              showKnowInput={showKnowInput} knownDream={knownDream} setKnownDream={setKnownDream} onOpenExplorer={() => setShowExplorer(true)}
              expanded={expanded} setExpanded={setExpanded} />
          </div>
          <div style={{ width: '100%' }} className="h-full flex-shrink-0">
            <DreamerBotPanel quizQuestion={quizQuestion} quizOptions={quizOptions} quizCount={quizCount} quizLoading={quizLoading} quizError={quizError}
              answerQuiz={answerQuiz} matches={matches} matchLoading={matchLoading} matchError={matchError} retryMatches={retryMatches}
              buildFromMatch={buildFromMatch} exploreFromMatch={exploreFromMatch}
              startQuiz={startQuiz} quizStarted={quizStarted} />
          </div>
        </div>

        <div className="flex items-center justify-around px-2 pb-5 pt-3" style={{ background: 'rgba(11,11,34,0.6)', backdropFilter: 'blur(16px)', borderTop: `1px solid ${G.cardBorder}` }}>
          {navItems.map((item, i) => {
            const Icon = item.icon; const isActive = active === i;
            return (
              <button key={i} onClick={() => setActive(i)} className="dreamr-btn flex flex-col items-center gap-1 px-4 py-1">
                <Icon size={20} style={{ color: isActive ? G.textMain : G.textMuted, filter: isActive ? `drop-shadow(0 0 6px ${G.purple})` : 'none' }} />
                <span style={{ fontSize: '0.65rem', color: isActive ? G.textMain : G.textMuted, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showProfile && <ProfileSheet onClose={() => setShowProfile(false)} savedDreams={savedDreams} streak={streak} completedGoalsTotal={completedGoalsTotal} unlocked={unlocked} />}
      {showExplorer && <ExplorerSheet onClose={() => setShowExplorer(false)} query={explorerQuery} setQuery={setExplorerQuery} loading={explorerLoading} result={explorerResult} error={explorerError} onSearch={() => runExplorerSearch()} onBuild={buildFromExplorer} />}
    </div>
  );
}
