import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Map from './components/Map';
import Settings from './components/Settings';
import ClubAdmin from './components/ClubAdmin';
import UploadAdif from './components/UploadAdif';
import About from './components/About';
import UserGuide from './components/UserGuide';
import packageJson from '../package.json';

function HelpMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <div className="app-nav-help" ref={ref}>
      <button
        type="button"
        className="app-nav-help-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        HELP
      </button>
      {open && (
        <div className="app-nav-help-dropdown">
          <Link to="/help/about" className="app-nav-help-item">About</Link>
          <Link to="/help/user-guide" className="app-nav-help-item">User Guide</Link>
        </div>
      )}
    </div>
  );
}

function App() {
  const version = packageJson.version || '1.0.0';
  const appEnv = typeof __APP_ENV__ !== 'undefined' ? __APP_ENV__ : (import.meta.env.VITE_APP_ENV || 'dev');
  const gitBranch = typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : (import.meta.env.VITE_GIT_BRANCH || '');
  const isDev = appEnv === 'dev';

  return (
    <Router>
      <div className="app-root">
        {isDev && (
          <div className="app-dev-banner" role="alert">
            DEMO and SYNTHETIC DATA — NO ACTUAL CONTACTS
          </div>
        )}
        <Header />
        <nav className="app-nav">
          <Link to="/">MAP DISPLAY</Link>
          <Link to="/upload">UPLOAD ADIF</Link>
          <Link to="/settings">SETTINGS</Link>
          <Link to="/admin">CLUB ADMIN</Link>
          <HelpMenu />
        </nav>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Map />} />
            <Route path="/upload" element={<UploadAdif />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<ClubAdmin />} />
            <Route path="/help/about" element={<About />} />
            <Route path="/help/user-guide" element={<UserGuide />} />
          </Routes>
        </main>
        <footer className="app-footer">
          <span>QSOlive v{version}</span>
          <span className="app-footer-sep">|</span>
          <span
            className={`app-env-badge app-env-badge--${appEnv}`}
            title={isDev && gitBranch ? `Branch: ${gitBranch}` : `Environment: ${appEnv.toUpperCase()}`}
          >
            {appEnv.toUpperCase()}
          </span>
          {isDev && gitBranch && (
            <>
              <span className="app-footer-sep">|</span>
              <span className="app-env-branch" title="Git branch">{gitBranch}</span>
            </>
          )}
        </footer>
      </div>
    </Router>
  );
}

export default App;
