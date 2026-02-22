import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ClubAdmin() {
  const [myClubs, setMyClubs] = useState([]);
  const [allClubs, setAllClubs] = useState([]); // for master_admin
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedClub, setSelectedClub] = useState(null);
  const [roster, setRoster] = useState([]);
  const [newClubName, setNewClubName] = useState('');
  const [newOperator, setNewOperator] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchProfileAndClubs();
  }, []);

  useEffect(() => {
    if (selectedClub) {
      fetchRoster(selectedClub.id);
    } else {
      setRoster([]);
    }
  }, [selectedClub]);

  const fetchProfileAndClubs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setCurrentUserId(user.id);
      const masterAdmin = profile?.role === 'master_admin';
      setIsMasterAdmin(masterAdmin);

      const { data: owned, error: errOwned } = await supabase
        .from('clubs')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (errOwned) throw errOwned;
      setMyClubs(owned || []);

      if (masterAdmin) {
        const { data: all, error: errAll } = await supabase
          .from('clubs')
          .select('*')
          .order('name');
        if (!errAll) setAllClubs(all || []);
      } else {
        setAllClubs([]);
      }
    } catch (error) {
      console.error('Error fetching clubs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoster = async (clubId) => {
    const { data, error } = await supabase
      .from('club_roster')
      .select('*')
      .eq('club_id', clubId)
      .order('callsign');
    
    if (error) console.error('Error fetching roster:', error);
    else setRoster(data || []);
  };

  const handleCreateClub = async (e) => {
    e.preventDefault();
    if (!newClubName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMessage({ type: 'error', text: 'You must be logged in to create a club.' });
        return;
      }

      const { data, error } = await supabase
        .from('clubs')
        .insert([{ name: newClubName, owner_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setMyClubs(prev => [data, ...prev]);
      if (isMasterAdmin) setAllClubs(prev => [data, ...prev].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setNewClubName('');
      setMessage({ type: 'success', text: `Club "${data.name}" created!` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleAddOperator = async (e) => {
    e.preventDefault();
    if (!selectedClub || !newOperator.trim()) return;

    try {
      const callsign = newOperator.toUpperCase().trim();
      // Insert into the backend table
      const { error } = await supabase
        .from('club_roster')
        .insert([{ club_id: selectedClub.id, callsign: callsign }]);

      if (error) {
        if (error.code === '23505') throw new Error('Operator already in roster'); // Unique violation
        throw error;
      }

      await fetchRoster(selectedClub.id);
      setNewOperator('');
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleRemoveOperator = async (id) => {
    try {
      const { error } = await supabase
        .from('club_roster')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setRoster(roster.filter(r => r.id !== id));
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const clubList = isMasterAdmin ? allClubs : myClubs;

  if (loading) return <div className="settings-loading">Loading admin panel...</div>;

  return (
    <div className="admin-page">
      <h2 className="admin-title">Club Administration</h2>

      {message && (
        <div className={`settings-message ${message.type === 'success' ? 'settings-message-success' : 'settings-message-error'}`}>
          {message.text}
          <button type="button" onClick={() => setMessage(null)} className="admin-msg-dismiss">×</button>
        </div>
      )}

      <div className="admin-grid">
        <div className="admin-sidebar">
          <div>
            <h3 className="admin-subtitle">{isMasterAdmin ? 'All Clubs' : 'My Clubs'}</h3>
            {isMasterAdmin && <p className="admin-hint">You can manage roster for any club.</p>}
            <form onSubmit={handleCreateClub} className="admin-form">
              <input
                type="text"
                value={newClubName}
                onChange={(e) => setNewClubName(e.target.value)}
                placeholder="New Club Name"
                className="settings-input"
              />
              <button type="submit" className="admin-create-btn">Create Club</button>
            </form>

            <div className="admin-club-list">
              {clubList.length === 0 && <p className="admin-empty">No clubs yet.</p>}
              {clubList.map(club => {
                const isOwner = club.owner_id === currentUserId;
                const isSelected = selectedClub?.id === club.id;
                return (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => setSelectedClub(club)}
                    className={`admin-club-btn ${isSelected ? 'admin-club-btn-selected' : ''}`}
                  >
                    {club.name}
                    {!isOwner && isMasterAdmin && <span className="admin-badge">manage</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="admin-main">
          {selectedClub ? (
            <>
              <h3 className="admin-subtitle">Roster: {selectedClub.name}</h3>

              <form onSubmit={handleAddOperator} className="admin-roster-form">
                <input
                  type="text"
                  value={newOperator}
                  onChange={(e) => setNewOperator(e.target.value)}
                  placeholder="Operator Callsign (e.g. W1ABC)"
                  className="settings-input admin-roster-input"
                />
                <button type="submit" className="admin-add-op-btn">Add Operator</button>
              </form>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Callsign</th>
                      <th>Added</th>
                      <th className="admin-th-action">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.length === 0 && (
                      <tr><td colSpan={3} className="admin-empty-cell">No operators in roster.</td></tr>
                    )}
                    {roster.map(op => (
                      <tr key={op.id}>
                        <td className="admin-td-call">{op.callsign}</td>
                        <td className="admin-td-date">{new Date(op.added_at).toLocaleDateString()}</td>
                        <td className="admin-td-action">
                          <button type="button" onClick={() => handleRemoveOperator(op.id)} className="admin-remove-btn">REMOVE</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="admin-placeholder">Select a club on the left to manage its roster</div>
          )}
        </div>
      </div>
    </div>
  );
}