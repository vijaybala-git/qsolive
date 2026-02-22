import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Auth({ onSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      onSuccess?.();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName || undefined } }
      });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Check your email to confirm your account, or sign in if already confirmed.' });
      onSuccess?.();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-box">
      <h3 className="auth-title">{isSignUp ? 'Sign up' : 'Sign in'}</h3>
      {message && (
        <div className={`auth-message ${message.type === 'error' ? 'auth-message-error' : 'auth-message-success'}`}>
          {message.text}
        </div>
      )}
      <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="auth-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="settings-input"
          required
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="settings-input"
          required
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />
        {isSignUp && (
          <input
            type="text"
            placeholder="Full name (optional)"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="settings-input"
            autoComplete="name"
          />
        )}
        <button type="submit" disabled={loading} className="settings-submit">
          {loading ? '…' : isSignUp ? 'Sign up' : 'Sign in'}
        </button>
      </form>
      <button type="button" onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }} className="auth-toggle">
        {isSignUp ? 'Already have an account? Sign in' : 'No account? Sign up'}
      </button>
    </div>
  );
}
