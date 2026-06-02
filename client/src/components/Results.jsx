import React, { useState, useEffect } from 'react';
import { sessionAPI, interviewAPI } from '../services/api';
import { InterviewReportPanel } from './InterviewReportPanel';
import '../styles/Results.css';

const formatScore = (score) => Number(score || 0).toFixed(1);
const formatDate = (value) => (value ? new Date(value).toLocaleString() : 'Not recorded');

const getSessionMetrics = (session) => {
  const questions = session?.questions || [];
  const answered = questions.filter((question) => typeof question.score === 'number');
  const correct = answered.filter((question) => question.isCorrect);
  const expectedCount = session?.setSize || questions.length || 10;
  const averageScore = Number(session?.averageScore || 0);
  const accuracy = answered.length ? (correct.length / answered.length) * 100 : 0;
  const completion = expectedCount ? (answered.length / expectedCount) * 100 : 0;

  return {
    answeredCount: answered.length,
    correctCount: correct.length,
    expectedCount,
    averageScore,
    accuracy,
    completion: Math.min(100, completion),
    bars: [
      { label: 'Score', value: averageScore },
      { label: 'Accuracy', value: accuracy },
      { label: 'Completion', value: Math.min(100, completion) },
    ],
  };
};

const getFeedback = (session, metrics) => {
  const skill = session?.skill || 'Practice';
  const moduleLabel = session?.moduleLabel || 'current module';
  const strengths = [];
  const focus = [];

  if (metrics.averageScore >= 85) strengths.push(`Strong performance in ${skill} ${moduleLabel}.`);
  if (metrics.accuracy >= 80) strengths.push('Most answers matched the evaluated question evidence.');
  if (metrics.completion >= 100) strengths.push('Completed the full set.');
  if (strengths.length === 0) strengths.push('Session submitted successfully; you now have a baseline score.');

  if (metrics.averageScore < 80) focus.push(`Review ${moduleLabel} before moving too quickly into the next set.`);
  if (metrics.accuracy < 70) focus.push('Slow down on answer selection and use the prompt evidence more directly.');
  if (metrics.completion < 100) focus.push('Finish every question in the set for a more accurate score.');
  if (focus.length === 0) focus.push('Keep the rhythm: continue to the next unlocked module set.');

  return { strengths, focus };
};

export const Results = () => {
  const [activeTab, setActiveTab] = useState('practice');

  // Practice sessions state
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Interview reports state
  const [interviews, setInterviews] = useState([]);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [interviewReport, setInterviewReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [interviewsLoaded, setInterviewsLoaded] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await sessionAPI.getUserSessions();
        const completed = res.data
          .filter((session) => session.status === 'Completed')
          .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        setSessions(completed);
        setSelectedSession(completed[0] || null);
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeTab === 'interviews' && !interviewsLoaded) {
      setInterviewsLoaded(true);
      interviewAPI.getUserInterviews().then((res) => {
        const completed = res.data.filter((i) => i.status === 'Completed');
        setInterviews(completed);
        if (completed.length > 0) loadReport(completed[0]._id);
      }).catch(() => {});
    }
  }, [activeTab, interviewsLoaded]);

  const loadReport = async (interviewId) => {
    setReportLoading(true);
    try {
      const res = await interviewAPI.getReport(interviewId);
      setSelectedInterview(res.data.interview);
      setInterviewReport(res.data.report);
    } catch (err) {
      console.error('Failed to load report', err);
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading results...</div>;

  const metrics = selectedSession ? getSessionMetrics(selectedSession) : null;
  const feedback = selectedSession && metrics ? getFeedback(selectedSession, metrics) : null;

  return (
    <div className="results-page">
      {/* Tab switcher */}
      <div className="results-tabs">
        <button
          className={`results-tab ${activeTab === 'practice' ? 'active' : ''}`}
          onClick={() => setActiveTab('practice')}
        >
          Practice Sessions
        </button>
        <button
          className={`results-tab ${activeTab === 'interviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('interviews')}
        >
          Interview Reports
        </button>
      </div>

      {/* Interview reports tab */}
      {activeTab === 'interviews' && (
        <InterviewReportPanel
          interviews={interviews}
          selectedInterview={selectedInterview}
          report={interviewReport}
          onSelect={loadReport}
          loading={reportLoading}
        />
      )}

      {/* Practice tab */}
      {activeTab === 'practice' && !selectedSession && (
        <div className="results-empty">
          <p>No completed sessions yet. Finish a practice set to see dynamic results.</p>
        </div>
      )}

      {activeTab === 'practice' && selectedSession && (
        <>
          <div className="results-hero">
            <div className="score-ring">
              <div className="score-text">{formatScore(metrics.averageScore)}</div>
            </div>
            <div className="results-info">
              <h3>
                {selectedSession.skill} {selectedSession.level} · {selectedSession.moduleLabel || 'Practice'}
              </h3>
              <p>
                Module {selectedSession.moduleOrder || '-'} · Set {selectedSession.moduleSetNumber || selectedSession.setNumber || '-'}
              </p>
              <p>
                {metrics.answeredCount}/{metrics.expectedCount} answered · {metrics.correctCount} correct · {formatDate(selectedSession.updatedAt)}
              </p>
            </div>
          </div>

          <div className="skill-bars">
            {metrics.bars.map((bar) => (
              <div key={bar.label} className="skill-bar-row">
                <span className="skill-label">{bar.label}</span>
                <div className="skill-bar-track">
                  <div className="skill-bar-fill" style={{ width: `${Math.max(0, Math.min(100, bar.value))}%` }} />
                </div>
                <span className="skill-score">{formatScore(bar.value)}</span>
              </div>
            ))}
          </div>

          <div className="feedback-cards">
            <div className="feedback-card">
              <h4>Strengths</h4>
              <ul>
                {feedback.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="feedback-card">
              <h4>Focus areas</h4>
              <ul>
                {feedback.focus.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="sessions-list">
            <h3>Completed Sessions</h3>
            {sessions.map((session) => {
              const itemMetrics = getSessionMetrics(session);
              return (
                <div
                  key={session._id}
                  className={`session-item ${selectedSession._id === session._id ? 'active' : ''}`}
                  onClick={() => setSelectedSession(session)}
                >
                  <div>
                    <strong>
                      {session.skill} {session.level}
                    </strong>
                    <span>
                      {session.moduleLabel || 'Practice'} · Set {session.moduleSetNumber || session.setNumber || '-'}
                    </span>
                  </div>
                  <div>{formatScore(itemMetrics.averageScore)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
