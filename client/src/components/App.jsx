import React, { useEffect, useRef, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Login } from './Login';
import { Register } from './Register';
import { Dashboard } from './Dashboard';
import { Practice } from './Practice';
import { MixedTests } from './MixedTests';
import { Interview } from './Interview';
import { Results } from './Results';
import { Admin } from './Admin';
import { AdminLogin } from './AdminLogin';
import Sidebar from './Sidebar';
import '../styles/App.css';
import '../styles/TestGuard.css';

export const App = () => {
  const { token, user, initializing, logout } = useContext(AuthContext);
  const [currentView, setCurrentView] = useState(() => localStorage.getItem('currentView') || 'dashboard');
  const [showLogin, setShowLogin] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [navWarning, setNavWarning] = useState(null); // { targetView }
  const [resumeTarget, setResumeTarget] = useState(null); // in-progress session to resume in Practice
  const [practiceStartSkill, setPracticeStartSkill] = useState(null);
  const testActiveRef = useRef(false); // MixedTests sets this to true when session is live
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  // MixedTests calls this to register/unregister test-in-progress state
  const registerTestActive = (active) => { testActiveRef.current = active; };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  const themeToggle = (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
      <strong>{theme === 'dark' ? 'Light' : 'Dark'}</strong>
    </button>
  );

  const handleSetView = (view) => {
    if (testActiveRef.current && view !== 'tests') {
      setNavWarning({ targetView: view });
      return;
    }
    setCurrentView(view);
    localStorage.setItem('currentView', view);
  };

  const confirmLeave = () => {
    if (navWarning) {
      testActiveRef.current = false;
      setCurrentView(navWarning.targetView);
      localStorage.setItem('currentView', navWarning.targetView);
      setNavWarning(null);
    }
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem('currentView');
    setCurrentView('dashboard');
    setShowLogin(true);
    testActiveRef.current = false;
    setNavWarning(null);
  };

  if (initializing) {
    return (
      <>
        {themeToggle}
        <div className="loading">Loading...</div>
      </>
    );
  }

  if (isAdminRoute) {
    if (!token) {
      return (
        <>
          {themeToggle}
          <AdminLogin />
        </>
      );
    }

    if (user?.role !== 'admin') {
      return (
        <>
          {themeToggle}
          <div className="admin-standalone">
            <div className="admin-denied-card">
              <span className="auth-kicker">Admin Portal</span>
              <h1>Access denied</h1>
              <p>This page is only available for admin accounts.</p>
              <div className="admin-denied-actions">
                <button type="button" className="btn-primary" onClick={handleLogout}>
                  Sign out
                </button>
                <button type="button" className="logout-btn" onClick={() => { window.location.href = '/'; }}>
                  Student app
                </button>
              </div>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="admin-standalone">
          <div className="admin-shell">
            <div className="admin-topbar">
              <div>
                <span className="auth-kicker">Admin Portal</span>
                <h1>FluentAI Admin CMS</h1>
              </div>
              <div className="admin-topbar-actions">
                {themeToggle}
                <button type="button" className="logout-btn" onClick={() => { window.location.href = '/'; }}>
                  Student app
                </button>
                <button type="button" className="logout-btn" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>
            <Admin />
          </div>
        </div>
      </>
    );
  }

  if (!token) {
    return (
      <>
        {themeToggle}
        {showLogin ? (
          <Login onSwitchToRegister={() => setShowLogin(false)} />
        ) : (
          <Register onSwitchToLogin={() => setShowLogin(true)} />
        )}
      </>
    );
  }

  return (
    <div className="app-container">
      <Sidebar currentView={currentView} onViewChange={handleSetView} onLogout={handleLogout} themeToggle={themeToggle} />
      <div className="main-content">
        {navWarning && (
          <div className="test-nav-warning">
            <span>Your test is still in progress. Are you sure you want to leave?</span>
            <div className="test-nav-warning-actions">
              <button type="button" className="test-nav-confirm" onClick={confirmLeave}>
                Yes, leave test
              </button>
              <button type="button" className="test-nav-cancel" onClick={() => setNavWarning(null)}>
                Stay in test
              </button>
            </div>
          </div>
        )}
        <div className="topbar">
          <h1>
            {currentView === 'dashboard' && 'Dashboard'}
            {currentView === 'practice' && 'Practice Hub'}
            {currentView === 'tests' && 'Level Tests'}
            {currentView === 'interview' && 'AI Mock Interview'}
            {currentView === 'results' && 'Session Results'}
          </h1>
          <div className="topbar-actions" />
        </div>
        <div className="content-area">
          {currentView === 'dashboard' && (
            <Dashboard
              setCurrentView={handleSetView}
              onStartPracticeSkill={(skill) => {
                setPracticeStartSkill(skill);
                handleSetView('practice');
              }}
              onResumePractice={(target) => {
                setResumeTarget(target);
                handleSetView('practice');
              }}
            />
          )}
          {currentView === 'practice' && (
            <Practice
              resumeSession={resumeTarget}
              initialSkill={practiceStartSkill}
              onInitialSkillConsumed={() => setPracticeStartSkill(null)}
              onMounted={() => setResumeTarget(null)}
            />
          )}
          {currentView === 'tests' && <MixedTests onTestActiveChange={registerTestActive} />}
          {currentView === 'interview' && <Interview setCurrentView={handleSetView} />}
          {currentView === 'results' && <Results />}
        </div>
      </div>
    </div>
  );
};

export default App;
