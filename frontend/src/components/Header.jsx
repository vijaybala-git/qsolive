import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Auth from './Auth';

export default function Header() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [monitorLabel, setMonitorLabel] = useState('');
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    let mounted = true;

    const resolveMonitorName = async (p) => {
      const config = p?.display_config || { mode: 'self' };
      if (config.mode === 'public') {
        if (mounted) setMonitorLabel('Public Club (all contacts)');
      } else {
      const clubIds = config.mode === 'clubs' && config.club_ids
        ? (Array.isArray(config.club_ids) ? config.club_ids : [config.club_ids])
        : [];
      if (clubIds.length > 0) {
        const { data: clubs, error } = await supabase.from('clubs').select('id,name').in('id', clubIds);
        if (mounted) {
          if (error) setMonitorLabel(`${clubIds.length} clubs`);
          else if (clubs?.length) setMonitorLabel(clubs.map(c => c.name).join(', '));
          else setMonitorLabel(`${clubIds.length} clubs`);
        }
      } else if (config.mode === 'club' && config.target_id) {
        const { data: club } = await supabase.from('clubs').select('name').eq('id', config.target_id).single();
        if (mounted) setMonitorLabel(club ? club.name : 'Unknown Club');
      } else if (mounted) setMonitorLabel('My Log');
      }
    };

    const fetchHeaderData = async (uid) => {
      if (!uid) return;
      const { data: profileData } = await supabase
        .from('profiles')
        .select('callsign, display_config, role')
        .eq('id', uid)
        .single();
      if (profileData && mounted) {
        setProfile(profileData);
        await resolveMonitorName(profileData);
      }
    };

    const onAuth = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (mounted) setUser(u);
      if (u) await fetchHeaderData(u.id);
      else setProfile(null);
    };

    onAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) fetchHeaderData(session.user.id);
      else setProfile(null);
    });

    const channel = supabase
      .channel('header_profile_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, async (payload) => {
        if (payload.new && mounted && user && payload.new.id === user.id) {
          const uid = user.id;
          const { data } = await supabase.from('profiles').select('callsign, display_config, role').eq('id', uid).single();
          if (data && mounted) {
            setProfile(data);
            await resolveMonitorName(data);
          }
        }
      })
      .subscribe();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <div className="app-header">
      <div className="app-header-row">
        <span className="app-header-dot" />
        <h1>QSOLive</h1>
      </div>
      {user ? (
        <div className="app-header-user">
          <div>
            <span className="app-header-callsign">{profile?.callsign || 'NO CALL'}</span>
            {profile?.role === 'master_admin' && <span className="app-header-badge">Master Admin</span>}
          </div>
          <div className="app-header-monitor">
            MONITORING: <span className="app-header-monitor-value">{monitorLabel || '…'}</span>
          </div>
          <button type="button" onClick={() => supabase.auth.signOut()} className="app-header-signout">Sign out</button>
        </div>
      ) : (
        <div className="app-header-guest">
          <span className="app-header-guest-text">Sign in to save settings and manage clubs.</span>
          <button type="button" onClick={() => setShowAuth(!showAuth)} className="app-header-signin-btn">
            {showAuth ? 'Hide' : 'Sign in'}
          </button>
          {showAuth && <Auth onSuccess={() => setShowAuth(false)} />}
        </div>
      )}
    </div>
  );
}