import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

const AVATAR_COLORS = [
  { bg: '#E8F5EF', text: '#2D7A5F' },
  { bg: '#E8EFFE', text: '#2B5FA8' },
  { bg: '#EEEDFB', text: '#5B4DB8' },
  { bg: '#FDF3E3', text: '#A05C0A' },
  { bg: '#FBE8E8', text: '#B83232' },
  { bg: '#F0EDF8', text: '#7B4EA8' },
];

const METRICS = [
  { key: 'steps',    label: 'steps',    unit: '',    color: '#2D7A5F', goal: 8000  },
  { key: 'calories', label: 'cal',      unit: '',    color: '#2B5FA8', goal: 2000  },
  { key: 'protein',  label: 'protein',  unit: 'g',   color: '#5B4DB8', goal: 150   },
  { key: 'sat_fat',  label: 'sat fat',  unit: 'g',   color: '#A05C0A', goal: 20    },
  { key: 'weight',   label: 'weight',   unit: 'lbs', color: '#B83232', goal: null  },
];

const today = () => new Date().toISOString().split('T')[0];
const fmt = (n, d = 0) => n == null || n === '' ? '—' : d > 0 ? Number(n).toFixed(d) : Math.round(Number(n)).toLocaleString();
const pct = (val, goal) => goal ? Math.min(100, Math.round((Number(val) / Number(goal)) * 100)) : null;
const initials = name => name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
const colorFor = (idx) => AVATAR_COLORS[idx % AVATAR_COLORS.length];

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [me, setMe] = useState(null);
  const [view, setView] = useState('squad');
  const [showOnboard, setShowOnboard] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: u }, { data: l }] = await Promise.all([
      supabase.from('users').select('*').order('created_at'),
      supabase.from('logs').select('*').order('date', { ascending: false }),
    ]);
    setUsers(u || []);
    setLogs(l || []);
    const savedId = localStorage.getItem('hs_me_id');
    if (savedId && u) {
      const found = u.find(x => x.id === savedId);
      if (found) setMe(found);
      else setShowOnboard(true);
    } else {
      setShowOnboard(u?.length === 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getLog = (userId, date) => logs.find(l => l.user_id === userId && l.date === date) || null;
  const todayLog = me ? getLog(me.id, today()) : null;

  const streak = (userId) => {
    let s = 0;
    const d = new Date();
    while (true) {
      const date = d.toISOString().split('T')[0];
      if (!logs.find(l => l.user_id === userId && l.date === date)) break;
      s++;
      d.setDate(d.getDate() - 1);
    }
    return s;
  };

  const weekDates = () => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });
  };

  const saveUser = async (name, goals) => {
    const colorIdx = users.length % AVATAR_COLORS.length;
    const { data, error } = await supabase.from('users').insert({ name, goals, color_idx: colorIdx }).select().single();
    if (!error && data) {
      setUsers(prev => [...prev, data]);
      setMe(data);
      localStorage.setItem('hs_me_id', data.id);
      setShowOnboard(false);
    }
  };

  const saveLog = async (userId, data) => {
    const existing = getLog(userId, today());
    if (existing) {
      const { data: updated } = await supabase.from('logs').update(data).eq('id', existing.id).select().single();
      if (updated) setLogs(prev => prev.map(l => l.id === updated.id ? updated : l));
    } else {
      const { data: created } = await supabase.from('logs').insert({ user_id: userId, date: today(), ...data }).select().single();
      if (created) setLogs(prev => [created, ...prev]);
    }
    setShowLog(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, color: 'var(--text-2)' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>loading squad...</div>
    </div>
  );

  if (showOnboard) return (
    <Onboard users={users} onAdd={saveUser} onSelect={u => { setMe(u); localStorage.setItem('hs_me_id', u.id); setShowOnboard(false); }} />
  );

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', minHeight: '100vh', paddingBottom: 80 }}>
      <Header me={me} users={users} onSwitch={u => { setMe(u); localStorage.setItem('hs_me_id', u.id); }} onAdd={() => setShowOnboard(true)} />
      <div style={{ padding: '12px 16px 0' }}>
        <div className="tab-bar">
          {['squad', 'me', 'history'].map(t => (
            <button key={t} className={`tab ${view === t ? 'active' : ''}`} onClick={() => setView(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: 16 }} className="fade-in">
        {view === 'squad' && <SquadView users={users} getLog={u => getLog(u.id, today())} streak={streak} />}
        {view === 'me' && me && <MeView me={me} log={todayLog} streak={streak(me.id)} weekDates={weekDates()} getLog={d => getLog(me.id, d)} onLog={() => setShowLog(true)} />}
        {view === 'history' && me && <HistoryView me={me} weekDates={weekDates()} getLog={d => getLog(me.id, d)} />}
      </div>
      {view === 'me' && (
        <div style={{ position: 'fixed', bottom: 24, right: 20 }}>
          <button className="btn-primary" onClick={() => setShowLog(true)} style={{ borderRadius: 24, padding: '10px 22px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            + log today
          </button>
        </div>
      )}
      {showLog && me && (
        <LogSheet me={me} existing={todayLog} onSave={d => saveLog(me.id, d)} onClose={() => setShowLog(false)} />
      )}
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────
function Header({ me, users, onSwitch, onAdd }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontFamily: 'var(--mono)', fontWeight: 500, fontSize: 15, letterSpacing: '-0.01em' }}>health squad</div>
      {me && (
        <div style={{ position: 'relative' }}>
          <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 20, padding: '5px 10px 5px 5px' }}>
            <div className="avatar" style={{ ...colorFor(me.color_idx || 0), width: 26, height: 26, fontSize: 11 }}>{initials(me.name)}</div>
            <span style={{ fontSize: 13 }}>{me.name.split(' ')[0]}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>▾</span>
          </button>
          {open && (
            <div style={{ position: 'absolute', right: 0, top: 38, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, minWidth: 170, zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
              {users.map(u => (
                <div key={u.id} onClick={() => { onSwitch(u); setOpen(false); }} style={{ padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: u.id === me.id ? 'var(--bg)' : 'transparent' }}>
                  <div className="avatar" style={{ ...colorFor(u.color_idx || 0), width: 24, height: 24, fontSize: 10 }}>{initials(u.name)}</div>
                  {u.name}
                  {u.id === me.id && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>you</span>}
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', padding: '9px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-2)' }} onClick={() => { onAdd(); setOpen(false); }}>
                + add person
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Squad view ───────────────────────────────────────────────────────────────
function SquadView({ users, getLog, streak }) {
  if (!users.length) return <Empty msg="no squad yet" />;
  const dow = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)', paddingBottom: 4 }}>{dow.toLowerCase()}</div>
      {users.map(u => <SquadCard key={u.id} user={u} log={getLog(u)} streak={streak(u.id)} />)}
    </div>
  );
}

function SquadCard({ user, log, streak }) {
  const goals = user.goals || {};
  const showMetrics = METRICS.filter(m => log?.[m.key] != null && log[m.key] !== '');
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: showMetrics.length ? 14 : 0 }}>
        <div className="avatar" style={colorFor(user.color_idx || 0)}>{initials(user.name)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{user.name}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {streak > 0 && <span className="badge badge-amber">🔥 {streak}d</span>}
            <span className={`badge ${log ? 'badge-green' : 'badge-gray'}`}>{log ? '✓ logged' : 'not yet'}</span>
          </div>
        </div>
      </div>
      {showMetrics.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(showMetrics.length, 4)}, 1fr)`, gap: 8 }}>
          {showMetrics.map(m => {
            const val = log[m.key];
            const goal = goals[m.key] || m.goal;
            const p = pct(val, goal);
            return (
              <div key={m.key} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: 500, fontSize: 14 }}>{m.key === 'weight' ? fmt(val, 1) : fmt(val)}{m.unit && <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 1 }}>{m.unit}</span>}</div>
                {p !== null && (
                  <div>
                    <div className="progress-track" style={{ marginTop: 6 }}>
                      <div className="progress-fill" style={{ width: `${p}%`, background: m.color }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3, fontFamily: 'var(--mono)' }}>{p}%</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Me view ──────────────────────────────────────────────────────────────────
function MeView({ me, log, streak, weekDates, getLog, onLog }) {
  const goals = me.goals || {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="avatar" style={{ ...colorFor(me.color_idx || 0), width: 44, height: 44, fontSize: 16 }}>{initials(me.name)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500 }}>{me.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
            {streak > 0 ? `🔥 ${streak}-day streak` : 'log today to start your streak'}
          </div>
        </div>
        {log
          ? <span className="badge badge-green">✓ logged</span>
          : <button className="btn-primary" onClick={onLog} style={{ borderRadius: 20, padding: '6px 14px', fontSize: 13 }}>log today</button>
        }
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        {METRICS.map(m => {
          const val = log?.[m.key];
          const goal = goals[m.key] || m.goal;
          const p = (val != null && val !== '') ? pct(val, goal) : null;
          const hasVal = val != null && val !== '';
          return (
            <div key={m.key} className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, fontFamily: 'var(--mono)' }}>{m.label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 500, fontSize: 22, color: hasVal ? 'var(--text)' : 'var(--text-3)' }}>
                {hasVal ? (m.key === 'weight' ? fmt(val, 1) : fmt(val)) : '—'}
              </div>
              {m.unit && hasVal && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{m.unit}</div>}
              {goal && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>goal {goal.toLocaleString()}</div>}
              {p !== null && (
                <div className="progress-track" style={{ marginTop: 8 }}>
                  <div className="progress-fill" style={{ width: `${p}%`, background: m.color }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-2)', marginBottom: 12 }}>this week</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {weekDates.map(date => {
            const hasLog = !!getLog(date);
            const isToday = date === today();
            const d = new Date(date + 'T12:00:00');
            return (
              <div key={date} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6, fontFamily: 'var(--mono)' }}>
                  {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                </div>
                <div style={{ width: 10, height: 10, borderRadius: '50%', margin: '0 auto', background: hasLog ? '#2D7A5F' : 'var(--bg)', border: isToday && !hasLog ? '2px solid #2D7A5F' : '1px solid var(--border)' }} />
                {isToday && <div style={{ fontSize: 9, color: '#2D7A5F', marginTop: 3, fontFamily: 'var(--mono)' }}>now</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── History ──────────────────────────────────────────────────────────────────
function HistoryView({ me, weekDates, getLog }) {
  const goals = me.goals || {};
  const entries = weekDates.map(d => ({ date: d, log: getLog(d) })).filter(e => e.log).reverse();
  if (!entries.length) return <Empty msg="no logs yet — hit 'me' and start tracking" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>last 7 days</div>
      {entries.map(({ date, log }) => {
        const d = new Date(date + 'T12:00:00');
        const shown = METRICS.filter(m => log[m.key] != null && log[m.key] !== '');
        return (
          <div key={date} className="card">
            <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-2)', marginBottom: 12 }}>
              {d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toLowerCase()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(shown.length, 4)}, 1fr)`, gap: 8 }}>
              {shown.map(m => {
                const goal = goals[m.key] || m.goal;
                const p = pct(log[m.key], goal);
                return (
                  <div key={m.key} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.label}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontWeight: 500, fontSize: 15, marginTop: 2 }}>
                      {m.key === 'weight' ? fmt(log[m.key], 1) : fmt(log[m.key])}{m.unit && <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 2 }}>{m.unit}</span>}
                    </div>
                    {p !== null && (
                      <div className="progress-track" style={{ marginTop: 6 }}>
                        <div className="progress-fill" style={{ width: `${p}%`, background: m.color }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {log.notes && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-2)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>{log.notes}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Log sheet ────────────────────────────────────────────────────────────────
function LogSheet({ me, existing, onSave, onClose }) {
  const goals = me.goals || {};
  const [data, setData] = useState({
    steps: existing?.steps ?? '',
    calories: existing?.calories ?? '',
    protein: existing?.protein ?? '',
    sat_fat: existing?.sat_fat ?? '',
    weight: existing?.weight ?? '',
    notes: existing?.notes ?? '',
  });
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet slide-up" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontWeight: 500 }}>log today <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, padding: 4, color: 'var(--text-2)' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {METRICS.map(m => {
            const goal = goals[m.key] || m.goal;
            return (
              <div key={m.key}>
                <label>{m.label}{m.unit && ` (${m.unit})`}</label>
                <input type="number" min="0" value={data[m.key]} onChange={e => set(m.key, e.target.value)} placeholder={goal ? `goal: ${goal}` : '—'} step={m.key === 'weight' ? '0.1' : '1'} />
              </div>
            );
          })}
          <div style={{ gridColumn: '1 / -1' }}>
            <label>notes</label>
            <input type="text" value={data.notes} onChange={e => set('notes', e.target.value)} placeholder="workout, how you felt…" />
          </div>
        </div>
        <button className="btn-primary" onClick={() => onSave(data)} style={{ width: '100%', marginTop: 20, padding: '12px', fontSize: 15, borderRadius: 12 }}>
          save
        </button>
      </div>
    </div>
  );
}

// ── Onboard ──────────────────────────────────────────────────────────────────
function Onboard({ users, onAdd, onSelect }) {
  const [step, setStep] = useState(users.length ? 'pick' : 'name');
  const [name, setName] = useState('');
  const [goals, setGoals] = useState({ steps: 8000, calories: 2000, protein: 150, sat_fat: 20, weight: '' });
  const setG = (k, v) => setGoals(g => ({ ...g, [k]: v }));

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '60px 20px' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 500, marginBottom: 6 }}>health squad</div>
      <div style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 36 }}>track together, stay honest</div>

      {step === 'pick' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>who are you?</div>
          {users.map(u => (
            <button key={u.id} onClick={() => onSelect(u)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', textAlign: 'left' }}>
              <div className="avatar" style={{ ...colorFor(u.color_idx || 0), width: 32, height: 32, fontSize: 12 }}>{initials(u.name)}</div>
              <span>{u.name}</span>
            </button>
          ))}
          <button onClick={() => setStep('name')} style={{ color: 'var(--text-2)', marginTop: 4, background: 'none', border: '1px dashed var(--border-strong)' }}>
            + add new person
          </button>
        </div>
      )}

      {step === 'name' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label>your name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="first name is fine" autoFocus onKeyDown={e => e.key === 'Enter' && name.trim() && setStep('goals')} />
          </div>
          <button className="btn-primary" disabled={!name.trim()} onClick={() => setStep('goals')} style={{ padding: '10px' }}>
            set goals →
          </button>
        </div>
      )}

      {step === 'goals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>set your daily targets</div>
          {METRICS.map(m => (
            <div key={m.key}>
              <label>{m.label}{m.unit && ` (${m.unit})`}</label>
              <input type="number" min="0" value={goals[m.key]} onChange={e => setG(m.key, e.target.value)} placeholder={m.goal ? String(m.goal) : 'optional'} />
            </div>
          ))}
          <button className="btn-primary" onClick={() => onAdd(name.trim(), goals)} style={{ padding: '12px', marginTop: 4, fontSize: 15 }}>
            let's go →
          </button>
        </div>
      )}
    </div>
  );
}

function Empty({ msg }) {
  return <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>{msg}</div>;
}
