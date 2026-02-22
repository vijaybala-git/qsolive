import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Header from './components/Header';
import Map from './components/Map';
import Settings from './components/Settings';
import ClubAdmin from './components/ClubAdmin';

function App() {
  return (
    <Router>
      <div className="app-root">
        <Header />
        <nav className="app-nav">
          <Link to="/">MAP DISPLAY</Link>
          <Link to="/settings">SETTINGS</Link>
          <Link to="/admin">CLUB ADMIN</Link>
        </nav>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Map />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<ClubAdmin />} />
          </Routes>
        </main>
        <footer className="app-footer">
          QSOLive v1.0 | Connected to Supabase
        </footer>
      </div>
    </Router>
  );
}

export default App;
