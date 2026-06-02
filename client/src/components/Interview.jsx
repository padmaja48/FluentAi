import React, { useState, useEffect, useRef, useCallback } from 'react';
import { interviewAPI, resumeAPI } from '../services/api';
import { PERSONAS } from '../lib/personas';
import { AvatarPortrait } from './interview/AvatarPortrait';
import VoiceIndicator from './interview/VoiceIndicator';
import '../styles/Interview.css';

const STEPS = ['Resume', 'Persona', 'Config', 'System Check'];
const MAX_VIOLATIONS = 3;

// ── Step 1: Resume Upload ─────────────────────────────────────────
function ResumeStep({ onNext }) {
  const [uploading, setUploading] = useState(false);
  const [resume, setResume] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    resumeAPI.getHistory().then(r => setHistory(r.data?.slice(0, 3) ?? [])).catch(() => {});
  }, []);

  const upload = async (file) => {
    if (!file) return;
    try {
      setUploading(true);
      setError('');
      const fd = new FormData();
      fd.append('resume', file);
      const res = await resumeAPI.upload(fd);
      setResume(res.data);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  return (
    <div className="iv-step">
      <h2 className="iv-step-title">Upload Your Resume</h2>
      <p className="iv-step-desc">We tailor questions specifically to your experience.</p>

      <div
        className={`iv-drop-zone ${uploading ? 'iv-drop-zone--loading' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => document.getElementById('resume-file-input').click()}
      >
        {uploading ? (
          <span>Uploading…</span>
        ) : resume ? (
          <span className="iv-drop-success">✓ {resume.fileName || resume.originalName || 'Resume uploaded'}</span>
        ) : (
          <>
            <span className="iv-drop-icon">📄</span>
            <span>Drag & drop PDF here, or click to browse</span>
          </>
        )}
        <input
          id="resume-file-input"
          type="file"
          accept=".pdf,.doc,.docx"
          style={{ display: 'none' }}
          onChange={(e) => upload(e.target.files[0])}
        />
      </div>

      {error && <p className="iv-error">{error}</p>}

      {(resume?.analysis || resume?.parsedData) && (
        <div className="iv-resume-preview">
          <p><strong>Skills detected:</strong> {(resume.analysis?.skills || resume.parsedData?.skills)?.join(', ') || 'N/A'}</p>
          <p><strong>Experience level:</strong> {resume.analysis?.experienceLevel || resume.parsedData?.experienceLevel || 'N/A'}</p>
        </div>
      )}

      {history.length > 0 && !resume && (
        <div className="iv-resume-history">
          <p className="iv-resume-history-label">Or use a previous resume:</p>
          {history.map((r) => (
            <button
              key={r._id}
              className="iv-btn iv-btn--ghost"
              onClick={() => setResume(r)}
            >
              {r.fileName || r.originalName || 'Previous resume'}
            </button>
          ))}
        </div>
      )}

      <div className="iv-step-actions">
        <button
          className="iv-btn iv-btn--primary"
          disabled={!resume}
          onClick={() => onNext({ resume })}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Persona Selection ─────────────────────────────────────
function PersonaStep({ onNext, onBack }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="iv-step">
      <h2 className="iv-step-title">Choose Your Interviewer</h2>
      <p className="iv-step-desc">Each interviewer has a distinct style and communication approach.</p>

      <div className="iv-persona-grid">
        {PERSONAS.map((p) => (
          <div
            key={p.id}
            className={`iv-persona-card ${selected?.id === p.id ? 'iv-persona-card--selected' : ''}`}
            onClick={() => setSelected(p)}
          >
            <div className="iv-persona-avatar">
              <AvatarPortrait persona={p} isSpeaking={false} audioLevel={0} />
            </div>
            <div className="iv-persona-info">
              <span className="iv-persona-flag">{p.flag}</span>
              <h3 className="iv-persona-name">{p.name}</h3>
              <p className="iv-persona-title">{p.title} · {p.company}</p>
              <p className="iv-persona-accent">{p.accent}</p>
              <p className="iv-persona-personality">{p.personality}</p>
            </div>
            {selected?.id === p.id && <span className="iv-persona-check">✓</span>}
          </div>
        ))}
      </div>

      <div className="iv-step-actions">
        <button className="iv-btn iv-btn--ghost" onClick={onBack}>← Back</button>
        <button
          className="iv-btn iv-btn--primary"
          disabled={!selected}
          onClick={() => onNext({ persona: selected })}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Interview Configuration ──────────────────────────────
function ConfigStep({ persona, onNext, onBack }) {
  const [config, setConfig] = useState({
    roleLevel: 'Mid',
    roleDomain: 'Software Engineering',
    interviewType: 'Mixed',
    complexity: 'Intermediate',
    duration: 30,
  });

  const toggle = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  const opts = (key, items) => (
    <div className="iv-toggle-group">
      {items.map(item => (
        <button
          key={item}
          className={`iv-toggle-btn ${config[key] === item ? 'iv-toggle-btn--active' : ''}`}
          onClick={() => toggle(key, item)}
        >
          {item}
        </button>
      ))}
    </div>
  );

  return (
    <div className="iv-step">
      <h2 className="iv-step-title">Interview Configuration</h2>
      <p className="iv-step-desc">
        Interviewing with <strong>{persona?.name}</strong> — {persona?.title}
      </p>

      <div className="iv-config-form">
        <label className="iv-label">Role Domain</label>
        <input
          className="iv-input"
          value={config.roleDomain}
          onChange={(e) => toggle('roleDomain', e.target.value)}
          placeholder="e.g. Backend Engineering, Product Management"
        />

        <label className="iv-label">Experience Level</label>
        {opts('roleLevel', ['Fresher', 'Mid', 'Senior', 'Lead'])}

        <label className="iv-label">Interview Type</label>
        {opts('interviewType', ['Behavioural', 'Technical', 'Mixed'])}

        <label className="iv-label">Complexity</label>
        {opts('complexity', ['Beginner', 'Intermediate', 'Advanced'])}

        <label className="iv-label">Duration</label>
        {opts('duration', [15, 30, 45])}
      </div>

      <div className="iv-step-actions">
        <button className="iv-btn iv-btn--ghost" onClick={onBack}>← Back</button>
        <button
          className="iv-btn iv-btn--primary"
          onClick={() => onNext({ config })}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// ── Step 4: System Check ──────────────────────────────────────────
function SystemCheckStep({ onStart, onBack, loading }) {
  const videoRef = useRef(null);
  const analyserRef = useRef(null);
  const animRef = useRef(null);
  const [camOk, setCamOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream;
    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCamOk(true);
        setMicOk(true);

        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setMicLevel(avg / 128);
          animRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError('Could not access camera/microphone. Please grant permissions.');
      }
    };
    init();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div className="iv-step">
      <h2 className="iv-step-title">System Check</h2>
      <p className="iv-step-desc">Verify camera and microphone before starting.</p>

      {error && <p className="iv-error">{error}</p>}

      <div className="iv-sys-check">
        <div className="iv-cam-preview">
          <video ref={videoRef} muted playsInline className="iv-cam-video" />
        </div>

        <div className="iv-check-list">
          <div className={`iv-check-item ${camOk ? 'iv-check-item--ok' : ''}`}>
            <span className="iv-check-icon">{camOk ? '✓' : '○'}</span>
            Camera
          </div>
          <div className={`iv-check-item ${micOk ? 'iv-check-item--ok' : ''}`}>
            <span className="iv-check-icon">{micOk ? '✓' : '○'}</span>
            Microphone
          </div>
          <div className="iv-mic-bars">
            <VoiceIndicator audioLevel={micLevel} isActive={micOk} label="Mic level" />
          </div>
        </div>
      </div>

      <label className="iv-agree-label">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        {' '}I agree to interview conditions and fullscreen monitoring
      </label>

      <div className="iv-step-actions">
        <button className="iv-btn iv-btn--ghost" onClick={onBack}>← Back</button>
        <button
          className="iv-btn iv-btn--primary"
          disabled={!camOk || !agreed || loading}
          onClick={onStart}
        >
          {loading ? 'Creating Interview…' : 'Start Interview'}
        </button>
      </div>
    </div>
  );
}

// ── Live Session ──────────────────────────────────────────────────
function LiveSession({ interview, persona, onComplete }) {
  const [questions, setQuestions] = useState(interview.questions || []);
  const [currentIdx, setCurrentIdx] = useState(interview.currentQuestionIndex || 0);
  const [transcript, setTranscript] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [violations, setViolations] = useState(0);
  const [violationMsg, setViolationMsg] = useState('');
  const [terminated, setTerminated] = useState(false);
  const [timer, setTimer] = useState(interview.duration * 60 || 1800);
  const [interimText, setInterimText] = useState('');

  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const analyserRef = useRef(null);
  const animRef = useRef(null);
  const audioCtxRef = useRef(null);
  const timerRef = useRef(null);
  const violationCountRef = useRef(0);
  const autoSubmittedRef = useRef(false);
  const ttsSourceRef = useRef(null);
  const animFrameRef = useRef(null);

  const logViolation = useCallback(async (type, description) => {
    violationCountRef.current += 1;
    setViolations(violationCountRef.current);
    setViolationMsg(`Warning: ${description}`);
    try {
      await interviewAPI.logViolation(interview._id, type, description);
    } catch {}
    if (violationCountRef.current >= MAX_VIOLATIONS && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      // Complete interview on server before showing terminated screen
      try { await interviewAPI.completeInterview(interview._id); } catch {}
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setTerminated(true);
    }
    setTimeout(() => setViolationMsg(''), 4000);
  }, [interview._id]);

  // Fullscreen + tab switch enforcement
  useEffect(() => {
    const requestFS = async () => {
      try { await document.documentElement.requestFullscreen(); } catch {}
    };
    requestFS();

    const onFSChange = () => {
      if (!document.fullscreenElement && !autoSubmittedRef.current) {
        logViolation('fullscreen_exit', 'Exited fullscreen mode');
      }
    };
    const onVisibility = () => {
      if (document.hidden) logViolation('tab_switch', 'Switched to another tab');
    };
    const onBlur = () => logViolation('window_blur', 'Window lost focus');

    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [logViolation]);

  // Camera PiP
  useEffect(() => {
    let stream;
    const initCam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setAudioLevel(avg / 128);
          animRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {}
    };
    initCam();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            handleFinish();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Unlock audio autoplay on mount (user just clicked "Start Interview" = user gesture)
  useEffect(() => {
    try {
      const silentAudio = new Audio();
      // 0.1s of silence encoded as base64 WAV
      silentAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      silentAudio.volume = 0;
      silentAudio.play().catch(() => {});
    } catch {}
  }, []);

  // Cleanup TTS audio on unmount
  useEffect(() => () => {
    cancelAnimationFrame(animFrameRef.current);
    window.speechSynthesis?.cancel();
    if (ttsSourceRef.current) {
      ttsSourceRef.current.pause();
      ttsSourceRef.current.src = '';
    }
  }, []);

  // Play base64 audio using <audio> element — reliable across all browsers/autoplay policies
  const playAudioBase64 = useCallback((audioBase64, contentType, onEnd) => {
    return new Promise((resolve) => {
      try {
        // Stop any currently playing TTS
        if (ttsSourceRef.current) {
          ttsSourceRef.current.pause();
          if (ttsSourceRef.current._blobUrl) {
            URL.revokeObjectURL(ttsSourceRef.current._blobUrl);
          }
          ttsSourceRef.current = null;
        }

        const binaryStr = atob(audioBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: contentType || 'audio/mpeg' });
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        audio._blobUrl = url;
        ttsSourceRef.current = audio;

        // Drive audioLevel via Media Element + AnalyserNode
        const simLevel = () => {
          let level = 0.3 + Math.random() * 0.5;
          const tick = () => {
            if (!ttsSourceRef.current || ttsSourceRef.current.paused) return;
            level = 0.2 + Math.random() * 0.6;
            setAudioLevel(level);
            animFrameRef.current = requestAnimationFrame(tick);
          };
          tick();
        };

        audio.onplay = () => {
          setIsSpeaking(true);
          simLevel();
        };

        audio.onended = () => {
          cancelAnimationFrame(animFrameRef.current);
          setAudioLevel(0);
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          ttsSourceRef.current = null;
          if (onEnd) onEnd();
          resolve();
        };

        audio.onerror = () => {
          cancelAnimationFrame(animFrameRef.current);
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          ttsSourceRef.current = null;
          if (onEnd) onEnd();
          resolve();
        };

        audio.play().catch((err) => {
          console.warn('audio.play() blocked, falling back to Web Speech:', err);
          URL.revokeObjectURL(url);
          ttsSourceRef.current = null;
          cancelAnimationFrame(animFrameRef.current);
          // Don't call setIsSpeaking(false) yet — speakWithWebSpeech will manage it
          if (onEnd) onEnd();
          resolve();
        });
      } catch (err) {
        console.error('playAudioBase64 error:', err);
        setIsSpeaking(false);
        if (onEnd) onEnd();
        resolve();
      }
    });
  }, []);

  // Speak current question — ElevenLabs via server, fallback to Web Speech
  const speakQuestion = useCallback(async (questionText, addToTranscript = true) => {
    if (addToTranscript) {
      setTranscript(prev => {
        // Avoid duplicate: don't add if the last interviewer message is identical
        const last = [...prev].reverse().find(m => m.role === 'interviewer');
        if (last?.text === questionText) return prev;
        return [...prev, { role: 'interviewer', text: questionText }];
      });
    }
    try {
      const voiceStyle = persona?.voiceStyle || 'default';
      const res = await interviewAPI.speak(interview._id, questionText, voiceStyle);
      const { audioBase64, contentType } = res.data;

      if (audioBase64 && contentType?.includes('audio')) {
        await playAudioBase64(audioBase64, contentType, () => startListening());
      } else {
        speakWithWebSpeech(questionText, () => startListening());
      }
    } catch {
      speakWithWebSpeech(questionText, () => startListening());
    }
  }, [interview._id, persona, playAudioBase64]);

  // Reliable Web Speech API synthesis helper
  // useMale=true picks a male-sounding voice (for us-american and us-australian personas)
  const speakWithWebSpeech = useCallback((text, onEnd) => {
    if (!window.speechSynthesis) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
    utt.rate = 0.92;

    // Determine if we need a male voice based on persona
    const personaId = persona?.id;
    const wantMale = personaId === 'us-american' || personaId === 'us-australian' || personaId === 'ru-russian';

    const doSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const enVoices = voices.filter(v => v.lang.startsWith('en'));

      let chosen;
      if (wantMale) {
        // Prefer voices with "male" or common male names in their name
        chosen = enVoices.find(v => /male/i.test(v.name)) ||
                 enVoices.find(v => /david|mark|daniel|james|ryan|george|thomas|fred|alex/i.test(v.name)) ||
                 enVoices.find(v => v.lang === 'en-US' && !v.localService) ||
                 enVoices.find(v => v.lang === 'en-US') ||
                 enVoices[0];
        utt.pitch = 0.85; // lower pitch for male voice
      } else {
        // Female voice for Priya
        chosen = enVoices.find(v => /female/i.test(v.name)) ||
                 enVoices.find(v => /samantha|karen|victoria|zira|susan|lisa|moira|tessa/i.test(v.name)) ||
                 enVoices.find(v => v.lang === 'en-US') ||
                 enVoices[0];
        utt.pitch = 1.1;
      }

      if (chosen) utt.voice = chosen;

      utt.onend = () => { setIsSpeaking(false); onEnd?.(); };
      utt.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        setIsSpeaking(false);
        onEnd?.();
      };
      // Chrome bug: speechSynthesis can get stuck — resume if paused
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.speak(utt);
    };
    if (window.speechSynthesis.getVoices().length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true });
    }
  }, [persona]);

  // Speak first question on mount
  useEffect(() => {
    if (questions.length > 0) {
      const first = questions[0]?.question;
      if (first) speakQuestion(first);
    }
  }, []);

  // Speech recognition
  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setTranscript(prev => [...prev, { role: 'system', text: 'Speech recognition not supported. Please type your answer.' }]);
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setInterimText(interim);
      if (final) {
        setInterimText('');
        setTranscript(prev => [...prev, { role: 'candidate', text: final }]);
      }
    };
    rec.onend = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  };

  const stopListening = async () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
    setInterimText('');
  };

  const submitAnswer = async (answerText, skipped = false) => {
    if (!answerText && !skipped) return;
    try {
      const q = questions[currentIdx]?.question || '';
      await interviewAPI.submitAnswer(interview._id, q, answerText || '(no answer)');
    } catch {}
    const next = currentIdx + 1;
    if (next < questions.length) {
      setCurrentIdx(next);
      speakQuestion(questions[next].question);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    clearInterval(timerRef.current);
    try { await interviewAPI.completeInterview(interview._id); } catch {}
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onComplete(interview._id);
  };

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const currentQ = questions[currentIdx];

  if (terminated) {
    return (
      <div className="iv-terminated">
        <h2>Interview Terminated</h2>
        <p>You exceeded the maximum number of integrity violations ({MAX_VIOLATIONS}).</p>
        <p>Your session has been auto-submitted for review.</p>
        <button className="iv-btn iv-btn--primary" onClick={() => onComplete(interview._id)}>
          View Results
        </button>
      </div>
    );
  }

  return (
    <div className="iv-live">
      {/* Proctor bar */}
      <div className="iv-proctor-bar">
        <video ref={videoRef} muted playsInline className="iv-pip" />
        <span className="iv-timer" data-warn={timer < 300}>{fmtTime(timer)}</span>
        <span className="iv-q-counter">Q {currentIdx + 1} / {questions.length}</span>
        <span className="iv-rec-dot">REC</span>
        {violations > 0 && (
          <span className="iv-violation-count">{violations}/{MAX_VIOLATIONS} violations</span>
        )}
      </div>

      {violationMsg && <div className="iv-violation-banner">{violationMsg}</div>}

      <div className="iv-session-body">
        {/* Left: Avatar */}
        <div className="iv-avatar-panel">
          <div className="iv-avatar-wrap">
            <AvatarPortrait persona={persona} isSpeaking={isSpeaking} audioLevel={audioLevel} isListening={isListening} />
          </div>
          <VoiceIndicator audioLevel={audioLevel} isActive={isSpeaking} label={isSpeaking ? persona?.name : ''} />
          <p className="iv-persona-tag">{persona?.flag} {persona?.name}</p>
        </div>

        {/* Right: Transcript */}
        <div className="iv-transcript-panel">
          <div className="iv-transcript-scroll">
            {transcript.map((msg, i) => (
              <div key={i} className={`iv-msg iv-msg--${msg.role}`}>
                <span className="iv-msg-role">
                  {msg.role === 'interviewer' ? persona?.name : msg.role === 'candidate' ? 'You' : 'System'}
                </span>
                <span className="iv-msg-text">{msg.text}</span>
              </div>
            ))}
            {interimText && (
              <div className="iv-msg iv-msg--interim">
                <span className="iv-msg-role">You (typing…)</span>
                <span className="iv-msg-text">{interimText}</span>
              </div>
            )}
          </div>

          {currentQ && (
            <div className="iv-current-q">
              <span className="iv-current-q-label">Current question:</span>
              <span className="iv-current-q-text">{currentQ.question}</span>
            </div>
          )}

          <div className="iv-controls">
            <VoiceIndicator audioLevel={isListening ? audioLevel : 0} isActive={isListening} label="" color="blue" />
            <button
              className={`iv-btn ${isListening ? 'iv-btn--danger' : 'iv-btn--primary'}`}
              onMouseDown={startListening}
              onMouseUp={async () => {
                await stopListening();
                // Collect all candidate lines since the last interviewer message
                const lastInterviewerIdx = [...transcript].reverse().findIndex(m => m.role === 'interviewer');
                const cutoff = lastInterviewerIdx === -1 ? 0 : transcript.length - lastInterviewerIdx;
                const ans = transcript
                  .slice(cutoff)
                  .filter(m => m.role === 'candidate')
                  .map(m => m.text)
                  .join(' ')
                  .trim();
                if (ans) submitAnswer(ans);
              }}
            >
              {isListening ? 'Release to submit' : 'Hold to speak'}
            </button>
            <button className="iv-btn iv-btn--ghost" onClick={() => {
              stopListening();
              submitAnswer('', true);
            }}>
              Skip
            </button>
            <button className="iv-btn iv-btn--ghost" onClick={handleFinish}>
              End Interview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Interview Component ──────────────────────────────────────
export const Interview = ({ setCurrentView }) => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({});
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const persona = data.persona;

  const next = (partial) => {
    setData(prev => ({ ...prev, ...partial }));
    setStep(s => s + 1);
  };

  const back = () => setStep(s => s - 1);

  const handleStart = async () => {
    try {
      setLoading(true);
      setError('');
      const payload = {
        roleLevel: data.config?.roleLevel || 'Mid',
        roleDomain: data.config?.roleDomain || 'Software Engineering',
        interviewStyle: data.config?.interviewType || 'Mixed',
        duration: data.config?.duration || 30,
        resumeId: data.resume?._id,
        resumeText: data.resume?.rawText || data.resume?.extractedText,
        personaId: data.persona?.id,
        interviewType: data.config?.interviewType,
        complexity: data.config?.complexity,
      };
      const res = await interviewAPI.createInterview(payload);
      const iv = res.data;
      // Start the interview (generate questions)
      const startRes = await interviewAPI.startInterview(iv._id);
      setInterview(startRes.data?.interview ?? iv);
      setStep(4); // live session
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start interview.');
    } finally {
      setLoading(false);
    }
  };

  const onComplete = (interviewId) => {
    if (setCurrentView) setCurrentView('results');
  };

  if (step === 4 && interview) {
    return <LiveSession interview={interview} persona={persona} onComplete={onComplete} />;
  }

  return (
    <div className="iv-container">
      {/* Progress stepper */}
      <div className="iv-stepper">
        {STEPS.map((label, i) => (
          <div key={label} className={`iv-step-dot ${i < step ? 'iv-step-dot--done' : i === step ? 'iv-step-dot--active' : ''}`}>
            <span className="iv-step-num">{i < step ? '✓' : i + 1}</span>
            <span className="iv-step-label">{label}</span>
          </div>
        ))}
      </div>

      {error && <p className="iv-error iv-error--center">{error}</p>}

      {step === 0 && <ResumeStep onNext={next} />}
      {step === 1 && <PersonaStep onNext={next} onBack={back} />}
      {step === 2 && <ConfigStep persona={persona} onNext={next} onBack={back} />}
      {step === 3 && (
        <SystemCheckStep
          onStart={handleStart}
          onBack={back}
          loading={loading}
        />
      )}
    </div>
  );
};

export default Interview;
