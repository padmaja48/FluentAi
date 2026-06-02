import React, { useState, useEffect, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { questionAPI, testAPI, adminAPI } from '../services/api';
import '../styles/Admin.css';

const SKILLS = ['Listening', 'Speaking', 'Reading', 'Writing'];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const TYPES = ['MCQ', 'T-F-NG', 'Task', 'Essay'];
const STATUSES = ['Draft', 'Active', 'Archived'];

const CSV_TEMPLATE =
  'stem,skill,level,type,option_a,option_b,option_c,option_d,correct_option,correctAnswer,explanation,passageText,audioPrompt,topic,competency,journeyOrder,moduleOrder,moduleQuestionOrder\n';

// ── Helpers ───────────────────────────────────────────────────────
function parseCSVToQuestions(rows) {
  return rows.map((r) => ({
    stem: r.stem || '',
    skill: r.skill || 'Reading',
    level: r.level || 'A1',
    type: r.type || 'MCQ',
    options: ['a', 'b', 'c', 'd']
      .filter((k) => r[`option_${k}`])
      .map((k) => ({
        text: r[`option_${k}`],
        isCorrect: r.correct_option === k,
      })),
    correctAnswer: r.correctAnswer || '',
    explanation: r.explanation || '',
    passageText: r.passageText || '',
    audioPrompt: r.audioPrompt || '',
    topic: r.topic || '',
    competency: r.competency || '',
    journeyOrder: Number(r.journeyOrder) || 0,
    moduleOrder: Number(r.moduleOrder) || 0,
    moduleQuestionOrder: Number(r.moduleQuestionOrder) || 0,
    status: 'Active',
  }));
}

// ── Empty question form ───────────────────────────────────────────
const emptyQuestion = () => ({
  stem: '',
  skill: 'Reading',
  level: 'A1',
  type: 'MCQ',
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
  correctAnswer: '',
  explanation: '',
  audioUrl: '',
  audioPrompt: '',
  passageText: '',
  topic: '',
  competency: '',
  journeyOrder: 0,
  moduleOrder: 0,
  moduleQuestionOrder: 0,
  status: 'Active',
});

// ── Questions Tab ─────────────────────────────────────────────────
function QuestionsTab() {
  const [questions, setQuestions] = useState([]);
  const [filters, setFilters] = useState({ skill: '', level: '', type: '', status: '' });
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = new, object = edit
  const [form, setForm] = useState(emptyQuestion());
  const [audioFile, setAudioFile] = useState(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.skill) params.skill = filters.skill;
      if (filters.level) params.level = filters.level;
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      const res = await questionAPI.getQuestions(params.skill || undefined, params.level || undefined, params);
      setQuestions(res.data);
    } catch { setQuestions([]); }
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(emptyQuestion()); setDrawerOpen(true); };
  const openEdit = (q) => { setEditing(q); setForm({ ...emptyQuestion(), ...q }); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); setAudioFile(null); };

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setOption = (i, k, v) => setForm(prev => ({
    ...prev,
    options: prev.options.map((o, idx) => idx === i ? { ...o, [k]: v } : o),
  }));
  const addOption = () => setForm(prev => ({ ...prev, options: [...prev.options, { text: '', isCorrect: false }] }));
  const removeOption = (i) => setForm(prev => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }));

  const handleAudioUpload = async () => {
    if (!audioFile) return;
    setUploadingAudio(true);
    try {
      const fd = new FormData();
      fd.append('audio', audioFile);
      const res = await questionAPI.uploadAudio(fd);
      setField('audioUrl', res.data.audioUrl);
      flash('Audio uploaded');
    } catch { flash('Audio upload failed', true); }
    setUploadingAudio(false);
  };

  const flash = (text, err = false) => {
    setMsg(err ? `❌ ${text}` : `✓ ${text}`);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing) {
        await questionAPI.updateQuestion(editing._id, payload);
        flash('Question updated');
      } else {
        await questionAPI.createQuestion(payload);
        flash('Question created');
      }
      closeDrawer();
      load();
    } catch (e) { flash(e.response?.data?.message || 'Save failed', true); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await questionAPI.deleteQuestion(id);
    setDeleteTarget(null);
    flash('Deleted');
    load();
  };

  return (
    <div className="adm-tab-content">
      {msg && <div className="adm-flash">{msg}</div>}

      {/* Filter bar */}
      <div className="adm-filters">
        {[['skill', SKILLS], ['level', LEVELS], ['type', TYPES], ['status', STATUSES]].map(([key, opts]) => (
          <select key={key} className="adm-select" value={filters[key]}
            onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}>
            <option value="">All {key}</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <button className="adm-btn adm-btn--primary" onClick={openNew}>+ Add Question</button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="adm-loading">Loading…</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Stem</th><th>Skill</th><th>Level</th><th>Type</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.length === 0 && (
                <tr><td colSpan={6} className="adm-empty">No questions found</td></tr>
              )}
              {questions.map((q) => (
                <tr key={q._id}>
                  <td className="adm-stem">{q.stem?.slice(0, 60)}{q.stem?.length > 60 ? '…' : ''}</td>
                  <td>{q.skill}</td>
                  <td>{q.level}</td>
                  <td>{q.type}</td>
                  <td><span className={`adm-badge adm-badge--${q.status?.toLowerCase()}`}>{q.status}</span></td>
                  <td className="adm-actions">
                    <button className="adm-btn adm-btn--sm" onClick={() => openEdit(q)}>Edit</button>
                    <button className="adm-btn adm-btn--sm adm-btn--danger"
                      onClick={() => setDeleteTarget(q)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="adm-overlay">
          <div className="adm-dialog">
            <h3>Delete Question?</h3>
            <p>"{deleteTarget.stem?.slice(0, 80)}"</p>
            <div className="adm-dialog-actions">
              <button className="adm-btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="adm-btn adm-btn--danger" onClick={() => handleDelete(deleteTarget._id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <div className="adm-overlay" onClick={closeDrawer}>
          <div className="adm-drawer" onClick={e => e.stopPropagation()}>
            <div className="adm-drawer-header">
              <h3>{editing ? 'Edit Question' : 'New Question'}</h3>
              <button className="adm-close" onClick={closeDrawer}>✕</button>
            </div>
            <div className="adm-drawer-body">
              <label className="adm-label">Stem / Question</label>
              <textarea className="adm-textarea" value={form.stem}
                onChange={e => setField('stem', e.target.value)} rows={3} />

              <div className="adm-row">
                <div>
                  <label className="adm-label">Skill</label>
                  <select className="adm-select" value={form.skill}
                    onChange={e => setField('skill', e.target.value)}>
                    {SKILLS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="adm-label">Level</label>
                  <select className="adm-select" value={form.level}
                    onChange={e => setField('level', e.target.value)}>
                    {LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="adm-label">Type</label>
                  <select className="adm-select" value={form.type}
                    onChange={e => setField('type', e.target.value)}>
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="adm-label">Status</label>
                  <select className="adm-select" value={form.status}
                    onChange={e => setField('status', e.target.value)}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* MCQ options */}
              {['MCQ', 'T-F-NG'].includes(form.type) && (
                <>
                  <label className="adm-label">Options</label>
                  {form.options.map((opt, i) => (
                    <div key={i} className="adm-option-row">
                      <input
                        type="radio"
                        name="correct"
                        checked={opt.isCorrect}
                        onChange={() => setForm(prev => ({
                          ...prev,
                          options: prev.options.map((o, idx) => ({ ...o, isCorrect: idx === i })),
                        }))}
                      />
                      <input className="adm-input" value={opt.text}
                        onChange={e => setOption(i, 'text', e.target.value)}
                        placeholder={`Option ${i + 1}`} />
                      <button className="adm-btn adm-btn--sm adm-btn--danger"
                        onClick={() => removeOption(i)}>✕</button>
                    </div>
                  ))}
                  <button className="adm-btn adm-btn--sm" onClick={addOption}>+ Add option</button>
                </>
              )}

              <label className="adm-label">Correct Answer (text)</label>
              <input className="adm-input" value={form.correctAnswer}
                onChange={e => setField('correctAnswer', e.target.value)} />

              <label className="adm-label">Explanation</label>
              <textarea className="adm-textarea" value={form.explanation}
                onChange={e => setField('explanation', e.target.value)} rows={2} />

              {/* Audio upload */}
              <label className="adm-label">Audio File (Listening)</label>
              <div className="adm-audio-row">
                <input type="file" accept="audio/*"
                  onChange={e => setAudioFile(e.target.files[0])} />
                <button className="adm-btn adm-btn--sm" onClick={handleAudioUpload}
                  disabled={!audioFile || uploadingAudio}>
                  {uploadingAudio ? 'Uploading…' : 'Upload'}
                </button>
              </div>
              {form.audioUrl && (
                <p className="adm-audio-url">✓ Audio: <a href={form.audioUrl} target="_blank" rel="noreferrer">Preview</a></p>
              )}

              <label className="adm-label">Passage Text (Reading)</label>
              <textarea className="adm-textarea" value={form.passageText}
                onChange={e => setField('passageText', e.target.value)} rows={4} />

              <label className="adm-label">Audio Prompt (Speaking)</label>
              <input className="adm-input" value={form.audioPrompt}
                onChange={e => setField('audioPrompt', e.target.value)} />

              <div className="adm-row">
                <div>
                  <label className="adm-label">Topic</label>
                  <input className="adm-input" value={form.topic}
                    onChange={e => setField('topic', e.target.value)} />
                </div>
                <div>
                  <label className="adm-label">Competency</label>
                  <input className="adm-input" value={form.competency}
                    onChange={e => setField('competency', e.target.value)} />
                </div>
              </div>

              <div className="adm-row">
                {[['journeyOrder', 'Journey Order'], ['moduleOrder', 'Module Order'], ['moduleQuestionOrder', 'Q Order']].map(([k, label]) => (
                  <div key={k}>
                    <label className="adm-label">{label}</label>
                    <input className="adm-input" type="number" value={form[k]}
                      onChange={e => setField(k, Number(e.target.value))} />
                  </div>
                ))}
              </div>
            </div>
            <div className="adm-drawer-footer">
              <button className="adm-btn" onClick={closeDrawer}>Cancel</button>
              <button className="adm-btn adm-btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bulk Upload Tab ───────────────────────────────────────────────
function BulkTab() {
  const [csvFile, setCsvFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleCSV = (file) => {
    if (!file) return;
    setCsvFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setPreview(parseCSVToQuestions(res.data).slice(0, 5)),
    });
  };

  const handleInsert = async () => {
    if (!csvFile) return;
    setBusy(true);
    try {
      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (res) => {
          const questions = parseCSVToQuestions(res.data);
          const r = await questionAPI.bulkInsert(questions);
          setResult(r.data);
          setBusy(false);
        },
      });
    } catch (e) {
      setResult({ error: e.message });
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'questions_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="adm-tab-content">
      <div className="adm-bulk-header">
        <h3>Bulk Question Upload</h3>
        <button className="adm-btn adm-btn--ghost" onClick={downloadTemplate}>⬇ Download Template CSV</button>
      </div>

      <div
        className="adm-drop-zone"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleCSV(e.dataTransfer.files[0]); }}
        onClick={() => document.getElementById('bulk-csv').click()}
      >
        {csvFile ? (
          <span className="adm-drop-ok">✓ {csvFile.name} — {preview.length}+ rows parsed</span>
        ) : (
          <>
            <span className="adm-drop-icon">📂</span>
            <span>Drag & drop CSV here, or click to browse</span>
          </>
        )}
        <input id="bulk-csv" type="file" accept=".csv" style={{ display: 'none' }}
          onChange={e => handleCSV(e.target.files[0])} />
      </div>

      {preview.length > 0 && (
        <div className="adm-bulk-preview">
          <p className="adm-label">Preview (first {preview.length} rows):</p>
          <table className="adm-table">
            <thead><tr><th>Stem</th><th>Skill</th><th>Level</th><th>Type</th></tr></thead>
            <tbody>
              {preview.map((q, i) => (
                <tr key={i}>
                  <td>{q.stem?.slice(0, 60)}</td>
                  <td>{q.skill}</td>
                  <td>{q.level}</td>
                  <td>{q.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="adm-btn adm-btn--primary" onClick={handleInsert} disabled={busy}>
            {busy ? 'Uploading…' : 'Insert All Questions'}
          </button>
        </div>
      )}

      {result && (
        <div className="adm-bulk-result">
          {result.error ? (
            <p className="adm-error">{result.error}</p>
          ) : (
            <p>✓ Inserted: <strong>{result.inserted}</strong> · Errors: <strong>{result.errors?.length ?? 0}</strong></p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Test Builder Tab ──────────────────────────────────────────────
function TestsTab() {
  const [tests, setTests] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    level: 'B1',
    durationMinutes: 60,
    sections: [],
    isActive: true,
  });
  const [editingTest, setEditingTest] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const flash = (t, err = false) => { setMsg(err ? `❌ ${t}` : `✓ ${t}`); setTimeout(() => setMsg(''), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const [tr, qr] = await Promise.all([testAPI.list(), questionAPI.getQuestions(undefined, undefined, { status: 'Active' })]);
      setTests(tr.data);
      setQuestions(qr.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addSection = (skill) => {
    if (form.sections.find(s => s.skill === skill)) return;
    setForm(prev => ({ ...prev, sections: [...prev.sections, { skill, questionIds: [] }] }));
  };

  const removeSection = (skill) =>
    setForm(prev => ({ ...prev, sections: prev.sections.filter(s => s.skill !== skill) }));

  const toggleQuestion = (skill, qid) => {
    setForm(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.skill !== skill ? s : {
          ...s,
          questionIds: s.questionIds.includes(qid)
            ? s.questionIds.filter(id => id !== qid)
            : [...s.questionIds, qid],
        }
      ),
    }));
  };

  const openNew = () => {
    setEditingTest(null);
    setForm({ title: '', description: '', level: 'B1', durationMinutes: 60, sections: [], isActive: true });
    setShowForm(true);
  };

  const openEdit = (t) => {
    setEditingTest(t);
    setForm({
      title: t.title,
      description: t.description || '',
      level: t.level,
      durationMinutes: t.durationMinutes,
      sections: t.sections.map(s => ({ ...s, questionIds: s.questionIds.map(id => id.toString ? id.toString() : id) })),
      isActive: t.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingTest) {
        await testAPI.update(editingTest._id, form);
        flash('Test updated');
      } else {
        await testAPI.create(form);
        flash('Test created');
      }
      setShowForm(false);
      load();
    } catch (e) { flash(e.response?.data?.message || 'Save failed', true); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await testAPI.delete(id);
    flash('Deleted');
    load();
  };

  const skillQuestions = (skill) => questions.filter(q => q.skill === skill && q.level === form.level);

  return (
    <div className="adm-tab-content">
      {msg && <div className="adm-flash">{msg}</div>}

      <div className="adm-tests-header">
        <h3>Test Builder</h3>
        <button className="adm-btn adm-btn--primary" onClick={openNew}>+ New Test</button>
      </div>

      {loading ? <p className="adm-loading">Loading…</p> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Title</th><th>Level</th><th>Duration</th><th>Sections</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {tests.length === 0 && <tr><td colSpan={6} className="adm-empty">No tests yet</td></tr>}
              {tests.map(t => (
                <tr key={t._id}>
                  <td>{t.title}</td>
                  <td>{t.level}</td>
                  <td>{t.durationMinutes} min</td>
                  <td>{t.sections?.map(s => s.skill).join(', ')}</td>
                  <td><span className={`adm-badge adm-badge--${t.isActive ? 'active' : 'archived'}`}>{t.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="adm-actions">
                    <button className="adm-btn adm-btn--sm" onClick={() => openEdit(t)}>Edit</button>
                    <button className="adm-btn adm-btn--sm adm-btn--danger" onClick={() => handleDelete(t._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="adm-overlay" onClick={() => setShowForm(false)}>
          <div className="adm-drawer adm-drawer--wide" onClick={e => e.stopPropagation()}>
            <div className="adm-drawer-header">
              <h3>{editingTest ? 'Edit Test' : 'New Test'}</h3>
              <button className="adm-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="adm-drawer-body">
              <label className="adm-label">Title</label>
              <input className="adm-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

              <label className="adm-label">Description</label>
              <input className="adm-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

              <div className="adm-row">
                <div>
                  <label className="adm-label">Level</label>
                  <select className="adm-select" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>
                    {LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="adm-label">Duration (min)</label>
                  <input className="adm-input" type="number" value={form.durationMinutes}
                    onChange={e => setForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="adm-label">Active</label>
                  <input type="checkbox" checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                </div>
              </div>

              <label className="adm-label">Sections</label>
              <div className="adm-section-toggles">
                {SKILLS.map(skill => (
                  <button
                    key={skill}
                    className={`adm-btn adm-btn--sm ${form.sections.find(s => s.skill === skill) ? 'adm-btn--primary' : ''}`}
                    onClick={() => form.sections.find(s => s.skill === skill) ? removeSection(skill) : addSection(skill)}
                  >{skill}</button>
                ))}
              </div>

              {form.sections.map(section => (
                <div key={section.skill} className="adm-test-section">
                  <h4 className="adm-section-title">{section.skill} Questions</h4>
                  <div className="adm-q-picker">
                    {skillQuestions(section.skill).length === 0 && (
                      <p className="adm-empty">No {section.skill} questions at {form.level}</p>
                    )}
                    {skillQuestions(section.skill).map(q => {
                      const qid = q._id.toString ? q._id.toString() : q._id;
                      const checked = section.questionIds.includes(qid);
                      return (
                        <label key={qid} className={`adm-q-pick-item ${checked ? 'adm-q-pick-item--selected' : ''}`}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleQuestion(section.skill, qid)} />
                          {q.stem?.slice(0, 70)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="adm-drawer-footer">
              <button className="adm-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="adm-btn adm-btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingTest ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Students Analytics Tab ────────────────────────────────────────
function StudentsTab() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [anaLoading, setAnaLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    adminAPI.getAllUsers().then(r => setUsers(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const viewAnalytics = async (user) => {
    setSelected(user);
    setAnalytics(null);
    setAnaLoading(true);
    try {
      const r = await adminAPI.getUserAnalytics(user._id);
      setAnalytics(r.data);
    } catch {}
    setAnaLoading(false);
  };

  const bar = (score) => (
    <div className="adm-skill-bar-wrap">
      <div className="adm-skill-bar" style={{ width: `${Math.min(100, score || 0)}%` }} />
      <span>{Math.round(score || 0)}%</span>
    </div>
  );

  return (
    <div className="adm-tab-content">
      <h3>Student Analytics</h3>

      {loading ? <p className="adm-loading">Loading…</p> : (
        <div className="adm-students-layout">
          <div className="adm-students-list">
            <table className="adm-table">
              <thead><tr><th>Name</th><th>Email</th><th>Level</th><th></th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id} className={selected?._id === u._id ? 'adm-row--selected' : ''}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.level || '—'}</td>
                    <td><button className="adm-btn adm-btn--sm" onClick={() => viewAnalytics(u)}>View Progress</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="adm-analytics-panel">
              <h4>{selected.name}'s Progress</h4>
              {anaLoading && <p className="adm-loading">Loading analytics…</p>}
              {analytics && (
                <>
                  <section>
                    <h5 className="adm-section-title">Skill Scores (last 30 days)</h5>
                    {analytics.skillTrend.length === 0 && <p className="adm-empty">No practice data</p>}
                    {analytics.skillTrend.map(s => (
                      <div key={s._id} className="adm-skill-row">
                        <span className="adm-skill-name">{s._id}</span>
                        {bar(s.avgScore)}
                        <span className="adm-skill-sessions">{s.sessions} sessions</span>
                      </div>
                    ))}
                  </section>

                  <section>
                    <h5 className="adm-section-title">Recent Practice Sessions</h5>
                    <table className="adm-table">
                      <thead><tr><th>Date</th><th>Skill</th><th>Level</th><th>Score</th></tr></thead>
                      <tbody>
                        {analytics.recentSessions.slice(0, 10).map(s => (
                          <tr key={s._id}>
                            <td>{new Date(s.updatedAt || s.createdAt).toLocaleDateString()}</td>
                            <td>{s.skill}</td>
                            <td>{s.level}</td>
                            <td>{Math.round(s.averageScore || 0)}%</td>
                          </tr>
                        ))}
                        {analytics.recentSessions.length === 0 && <tr><td colSpan={4} className="adm-empty">No sessions</td></tr>}
                      </tbody>
                    </table>
                  </section>

                  <section>
                    <h5 className="adm-section-title">Interview History</h5>
                    <table className="adm-table">
                      <thead><tr><th>Date</th><th>Domain</th><th>Type</th><th>Score</th></tr></thead>
                      <tbody>
                        {analytics.interviewHistory.slice(0, 10).map(iv => (
                          <tr key={iv._id}>
                            <td>{new Date(iv.createdAt).toLocaleDateString()}</td>
                            <td>{iv.roleDomain}</td>
                            <td>{iv.interviewType || iv.interviewStyle}</td>
                            <td>{Math.round(iv.totalScore || 0)}%</td>
                          </tr>
                        ))}
                        {analytics.interviewHistory.length === 0 && <tr><td colSpan={4} className="adm-empty">No interviews</td></tr>}
                      </tbody>
                    </table>
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Admin Component ──────────────────────────────────────────
const TABS = ['Questions', 'Bulk Upload', 'Tests', 'Students'];

export const Admin = () => {
  const [activeTab, setActiveTab] = useState('Questions');

  return (
    <div className="adm-container">
      <div className="adm-header">
        <h1 className="adm-title">Admin CMS</h1>
      </div>

      <div className="adm-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`adm-tab ${activeTab === tab ? 'adm-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="adm-tab-panel">
        {activeTab === 'Questions' && <QuestionsTab />}
        {activeTab === 'Bulk Upload' && <BulkTab />}
        {activeTab === 'Tests' && <TestsTab />}
        {activeTab === 'Students' && <StudentsTab />}
      </div>
    </div>
  );
};

export default Admin;
