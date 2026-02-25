import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clubs, setClubs] = useState([]);
  
  const MAX_CLUBS = 4;
  // Form State
  const [callsign, setCallsign] = useState('');
  const [mode, setMode] = useState('self'); // 'self' | 'club' | 'clubs'
  const [selectedClubId, setSelectedClubId] = useState('');
  const [selectedClubIds, setSelectedClubIds] = useState([]); // for mode 'clubs', max 4
  const [message, setMessage] = useState(null);

  // Request to join club (Phase 1)
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [clubsWithOwner, setClubsWithOwner] = useState([]);
  const [requestClubId, setRequestClubId] = useState('');
  const [requestCallsign, setRequestCallsign] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestStatus, setRequestStatus] = useState(null); // 'copied' | 'no-email' | null

  useEffect(() => {
    fetchProfileAndClubs();
  }, []);

  useEffect(() => {
    if (showRequestForm && clubsWithOwner.length === 0) {
      fetchClubsWithOwner();
    }
  }, [showRequestForm]);

  useEffect(() => {
    if (showRequestForm && callsign) setRequestCallsign(callsign);
  }, [showRequestForm, callsign]);

  const fetchProfileAndClubs = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      // 1. Fetch Profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      // 2. Fetch Available Clubs
      const { data: clubsData, error: clubsError } = await supabase
        .from('clubs')
        .select('id, name')
        .order('name');

      if (clubsError) throw clubsError;

      setClubs(clubsData || []);

      // 3. Set Form State
      if (profile) {
        setCallsign(profile.callsign || '');
        const config = profile.display_config || {};
        const savedMode = config.mode || 'self';
        setMode(savedMode || 'public');
        setSelectedClubId(config.target_id || (clubsData && clubsData[0]?.id) || '');
        setSelectedClubIds(Array.isArray(config.club_ids) ? config.club_ids.slice(0, MAX_CLUBS) : []);
      }

    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClubsWithOwner = async () => {
    const { data, error } = await supabase
      .from('clubs')
      .select('id, name, owner_id, profiles(email)')
      .order('name');
    if (!error) setClubsWithOwner(data || []);
  };

  const selectedRequestClub = clubsWithOwner.find((c) => c.id === requestClubId);
  const ownerEmail = selectedRequestClub?.profiles?.email ?? null;

  const buildRequestEmailBody = () => {
    const clubName = selectedRequestClub?.name ?? 'Unknown club';
    let body = `Request to add my callsign to the club roster.\n\nClub: ${clubName}\nCallsign: ${(requestCallsign || '').trim().toUpperCase()}`;
    if ((requestMessage || '').trim()) body += `\n\nMessage:\n${requestMessage.trim()}`;
    return body;
  };

  const buildRequestEmailSubject = () => {
    const clubName = selectedRequestClub?.name ?? 'Unknown club';
    return `[QSOlive] Join request for club "${clubName}"`;
  };

  const handleOpenRequestEmail = () => {
    setRequestStatus(null);
    if (!requestClubId || !(requestCallsign || '').trim()) {
      setRequestStatus('missing');
      return;
    }
    if (!ownerEmail) {
      setRequestStatus('no-email');
      return;
    }
    const subject = encodeURIComponent(buildRequestEmailSubject());
    const body = encodeURIComponent(buildRequestEmailBody());
    window.location.href = `mailto:${ownerEmail}?subject=${subject}&body=${body}`;
  };

  const handleCopyRequest = async () => {
    setRequestStatus(null);
    if (!requestClubId || !(requestCallsign || '').trim()) return;
    const text = `${buildRequestEmailSubject()}\n\n${buildRequestEmailBody()}`;
    try {
      await navigator.clipboard.writeText(text);
      setRequestStatus('copied');
    } catch (e) {
      setRequestStatus('no-email');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('No user logged in');

      let displayConfig;
      if (mode === 'public') {
        displayConfig = { mode: 'public' };
      } else if (mode === 'clubs') {
        const ids = selectedClubIds.slice(0, MAX_CLUBS);
        if (ids.length === 0) throw new Error('Select at least one club for Multiple Clubs.');
        displayConfig = { mode: 'clubs', club_ids: ids };
      } else if (mode === 'club') {
        if (!selectedClubId) throw new Error('Select a club.');
        displayConfig = { mode: 'club', target_id: selectedClubId };
      } else {
        displayConfig = { mode: 'self', target_id: callsign || '' };
      }

      const updates = {
        id: user.id,
        callsign: callsign.toUpperCase(),
        display_config: displayConfig,
        updated_at: new Date(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(updates);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="settings-loading">Loading configuration...</div>;

  return (
    <div className="settings-page">
      <h2 className="settings-title">Display Configuration</h2>

      {message && (
        <div className={`settings-message ${message.type === 'success' ? 'settings-message-success' : 'settings-message-error'}`}>
          {message.text}
        </div>
      )}

      <div className="settings-form">
        <div>
          <label className="settings-label">MY CALLSIGN</label>
          <input
            type="text"
            value={callsign}
            onChange={(e) => setCallsign(e.target.value.toUpperCase())}
            className="settings-input"
            placeholder="W1ABC"
          />
        </div>

        <div>
          <label className="settings-label">MONITORING MODE</label>
          <div className="settings-radio-group">
            <label className="settings-radio">
              <input type="radio" checked={mode === 'public'} onChange={() => setMode('public')} />
              <div><span className="settings-radio-title">Public Club (all contacts)</span><span className="settings-radio-desc">Display all contacts, ignore club assignment</span></div>
            </label>
            <label className="settings-radio">
              <input type="radio" checked={mode === 'self'} onChange={() => setMode('self')} />
              <div><span className="settings-radio-title">My Personal Log</span><span className="settings-radio-desc">Display only contacts logged by {callsign || 'me'}</span></div>
            </label>
            <label className="settings-radio">
              <input type="radio" checked={mode === 'club'} onChange={() => setMode('club')} />
              <div><span className="settings-radio-title">One Club</span><span className="settings-radio-desc">Display contacts from one club</span></div>
            </label>
            <label className="settings-radio">
              <input type="radio" checked={mode === 'clubs'} onChange={() => setMode('clubs')} />
              <div><span className="settings-radio-title">Multiple Clubs</span><span className="settings-radio-desc">Display contacts from up to {MAX_CLUBS} clubs</span></div>
            </label>
          </div>
        </div>

        {mode === 'club' && (
          <div className="settings-club-block">
            <label className="settings-label">SELECT CLUB</label>
            <select value={selectedClubId} onChange={(e) => setSelectedClubId(e.target.value)} className="settings-input">
              <option value="" disabled>-- Choose a Club --</option>
              {clubs.map(club => (<option key={club.id} value={club.id}>{club.name}</option>))}
            </select>
          </div>
        )}

        {mode === 'clubs' && (
          <div className="settings-club-block">
            <label className="settings-label">SELECT CLUBS (up to {MAX_CLUBS})</label>
            <div className="settings-checkbox-group">
              {clubs.map(club => {
                const checked = selectedClubIds.includes(club.id);
                const disabled = !checked && selectedClubIds.length >= MAX_CLUBS;
                return (
                  <label key={club.id} className={`settings-checkbox ${disabled ? 'settings-checkbox-disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => {
                        if (checked) setSelectedClubIds(selectedClubIds.filter(id => id !== club.id));
                        else if (selectedClubIds.length < MAX_CLUBS) setSelectedClubIds([...selectedClubIds, club.id]);
                      }}
                    />
                    <span>{club.name}</span>
                  </label>
                );
              })}
            </div>
            {selectedClubIds.length > 0 && <p className="settings-hint">{selectedClubIds.length} of {MAX_CLUBS} selected</p>}
          </div>
        )}

        <button type="button" onClick={handleSave} disabled={saving} className="settings-submit">{saving ? 'SAVING...' : 'SAVE CONFIGURATION'}</button>

        <div className="settings-request-block">
          {!showRequestForm ? (
            <button type="button" onClick={() => setShowRequestForm(true)} className="settings-request-link">
              Request to join a club
            </button>
          ) : (
            <div className="settings-request-form">
              <div className="settings-request-header">
                <h3 className="settings-request-title">Request to join a club</h3>
                <button type="button" onClick={() => setShowRequestForm(false)} className="settings-request-close" aria-label="Close">×</button>
              </div>
              <p className="settings-request-desc">Send a request to the club manager so they can add your callsign to the roster.</p>
              <div>
                <label className="settings-label">CLUB</label>
                <select
                  value={requestClubId}
                  onChange={(e) => { setRequestClubId(e.target.value); setRequestStatus(null); }}
                  className="settings-input"
                >
                  <option value="">-- Choose a club --</option>
                  {clubsWithOwner.map((club) => (
                    <option key={club.id} value={club.id}>{club.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="settings-label">YOUR CALLSIGN</label>
                <input
                  type="text"
                  value={requestCallsign}
                  onChange={(e) => setRequestCallsign(e.target.value.toUpperCase())}
                  className="settings-input"
                  placeholder="W1ABC"
                />
              </div>
              <div>
                <label className="settings-label">MESSAGE (OPTIONAL)</label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  className="settings-input settings-request-message"
                  placeholder="e.g. I'm the club secretary, please add me."
                  rows={3}
                />
              </div>
              {requestStatus === 'missing' && (
                <p className="settings-request-note">Select a club and enter your callsign.</p>
              )}
              {requestStatus === 'no-email' && (
                <p className="settings-request-note">This club has no contact email. Use &quot;Copy to clipboard&quot; and send the request another way.</p>
              )}
              {requestStatus === 'copied' && (
                <p className="settings-request-copied">Copied to clipboard.</p>
              )}
              <div className="settings-request-actions">
                <button type="button" onClick={handleOpenRequestEmail} className="settings-request-btn settings-request-btn-email">
                  Open in email
                </button>
                <button type="button" onClick={handleCopyRequest} className="settings-request-btn settings-request-btn-copy">
                  Copy to clipboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}