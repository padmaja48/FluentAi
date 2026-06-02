import React from 'react';

const ScoreBar = ({ label, value, colorVar = 'var(--accent)' }) => (
  <div className="report-score-row">
    <span className="report-score-label">{label}</span>
    <div className="report-score-track">
      <div
        className="report-score-fill"
        style={{ width: `${Math.max(0, Math.min(100, value || 0))}%`, background: colorVar }}
      />
    </div>
    <span className="report-score-val">{value ?? '—'}</span>
  </div>
);

export const InterviewReportPanel = ({
  interviews,
  selectedInterview,
  report,
  onSelect,
  loading,
}) => {
  if (!interviews || interviews.length === 0) {
    return (
      <div className="report-empty">
        <p>
          No completed interviews yet. Start an AI mock interview to see your report here.
        </p>
      </div>
    );
  }

  return (
    <div className="report-layout">
      {/* LEFT: Interview list */}
      <div className="report-sidebar">
        <h3>Completed Interviews</h3>
        {interviews.map((iv) => (
          <div
            key={iv._id}
            className={`report-list-item ${selectedInterview?._id === iv._id ? 'active' : ''}`}
            onClick={() => onSelect(iv._id)}
          >
            <div className="report-list-persona">
              {iv.personaId?.replace('us-', '') || 'Interview'}
            </div>
            <div className="report-list-meta">
              {iv.interviewType || iv.interviewStyle} · {iv.duration}min
            </div>
            <div className="report-list-score">
              {iv.totalScore != null ? `${iv.totalScore}%` : '—'}
            </div>
            <div className="report-list-date">
              {new Date(iv.completedAt || iv.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {/* RIGHT: Report detail */}
      <div className="report-detail">
        {loading && <div className="loading">Loading report…</div>}

        {!loading && report && selectedInterview && (
          <>
            {/* Header */}
            <div className="report-header">
              <h2>Interview Report</h2>
              <div className="report-meta">
                {selectedInterview.personaId} ·{' '}
                {selectedInterview.interviewType || selectedInterview.interviewStyle} ·{' '}
                {selectedInterview.duration} min ·{' '}
                {new Date(
                  selectedInterview.completedAt || selectedInterview.createdAt,
                ).toLocaleString()}
              </div>
            </div>

            {/* Hero score */}
            <div className="report-hero">
              <div className="report-score-ring">
                <div className="report-score-big">{report.overallScore ?? '—'}</div>
              </div>
              <div className="report-summary-text">
                <p>{report.transcriptSummary}</p>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="report-section">
              <h3>Score Breakdown</h3>
              <ScoreBar label="Communication" value={report.communicationScore} colorVar="var(--success)" />
              <ScoreBar label="Technical"     value={report.technicalScore}     colorVar="var(--accent)" />
              <ScoreBar label="Behavioural"   value={report.behavioralScore}    colorVar="var(--warn)" />
            </div>

            {/* Strengths + Improvements */}
            <div className="report-two-col">
              <div className="report-card report-card-green">
                <h4>Strengths</h4>
                <ul>
                  {(report.strengths || []).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="report-card report-card-amber">
                <h4>Improvement Areas</h4>
                <ul>
                  {(report.improvements || []).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Recommendations */}
            <div className="report-section">
              <h3>Recommendations</h3>
              <ol className="report-recommendations">
                {(report.recommendations || []).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
            </div>

            {/* Q&A Transcript with per-question feedback */}
            <div className="report-section">
              <h3>Full Q&amp;A Transcript &amp; AI Feedback</h3>
              {(
                report.questionAnalysis?.length
                  ? report.questionAnalysis
                  : selectedInterview.questions || []
              ).map((item, idx) => (
                <div key={idx} className="report-qa-card">
                  <div className="report-qa-header">
                    <span className="report-q-num">Q{idx + 1}</span>
                    {item.questionType && (
                      <span className={`report-q-type type-${item.questionType}`}>
                        {item.questionType}
                      </span>
                    )}
                    {item.resumeReference && (
                      <span className="report-q-ref">{item.resumeReference}</span>
                    )}
                    {item.score != null && (
                      <span className="report-q-score">{item.score}/100</span>
                    )}
                  </div>

                  <div className="report-question">
                    <strong>Interviewer:</strong> {item.question}
                  </div>

                  <div className="report-answer">
                    <strong>Your answer:</strong>{' '}
                    {item.answer || item.userAnswer || (
                      <em className="report-no-answer">No answer recorded</em>
                    )}
                  </div>

                  {(item.feedback || item.whatWorked || item.whatToImprove) && (
                    <div className="report-ai-feedback">
                      <div className="report-feedback-label">AI Feedback</div>
                      {item.feedback && <p>{item.feedback}</p>}
                      {item.whatWorked && (
                        <div className="report-micro-row green">{item.whatWorked}</div>
                      )}
                      {item.whatToImprove && (
                        <div className="report-micro-row amber">{item.whatToImprove}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && !report && selectedInterview && (
          <div className="report-empty">
            <p>Report not yet available for this interview.</p>
          </div>
        )}
      </div>
    </div>
  );
};
