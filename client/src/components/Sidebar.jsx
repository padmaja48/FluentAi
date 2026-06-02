import React from 'react';
import '../styles/Sidebar.css';

const Sidebar = ({ currentView, onViewChange, onLogout, themeToggle }) => {
  const navItems = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'practice', icon: '📚', label: 'Practice' },
    { id: 'tests', icon: '🧪', label: 'Tests' },
    { id: 'interview', icon: '🎤', label: 'Interview' },
    { id: 'results', icon: '📊', label: 'Results' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">F</div>
        <span className="brand">Fluent<span>AI</span></span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <span className="icon">{item.icon}</span>
            <span className="label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {themeToggle}
        <button onClick={onLogout} className="logout-btn">
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
