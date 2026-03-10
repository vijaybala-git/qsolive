import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { parseAdifFile } from '../lib/adifParser';
import { adifRecordToContact } from '../lib/adifToContact';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const BATCH_SIZE = 50;

export default function UploadAdif() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [parsed, setParsed] = useState(null); // { contacts, errors }
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null); // { inserted, failed, errorMessage? }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(u);
      if (!u) {
        setLoading(false);
        return;
      }
      const { data: p } = await supabase.from('profiles').select('callsign').eq('id', u.id).single();
      if (mounted) setProfile(p || null);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const handleFileChange = (e) => {
    setFile(null);
    setFileError(null);
    setParsed(null);
    setResult(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setFileError(`File too large. Maximum size is ${MAX_FILE_BYTES / 1024 / 1024}MB.`);
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      const records = parseAdifFile(text);
      const contacts = [];
      const errors = [];
      const callsign = profile?.callsign?.trim() || '';
      if (!callsign) {
        setParsed({ contacts: [], errors: ['Set your callsign in Settings before uploading.'] });
        return;
      }
      for (const { fields, raw } of records) {
        const out = adifRecordToContact(fields, callsign, raw);
        if (out.error) errors.push({ call: fields.CALL || '?', error: out.error });
        else if (out.contact) contacts.push(out.contact);
      }
      setParsed({ contacts, errors });
    };
    reader.readAsText(f, 'UTF-8');
  };

  // Re-parse when profile loads after file was selected (so we get correct contacts with callsign)
  useEffect(() => {
    if (!file || !profile?.callsign?.trim()) return;
    const reader = new FileReader();
    reader.onload = () => {
      const records = parseAdifFile(reader.result);
      const contacts = [];
      const errors = [];
      const callsign = profile.callsign.trim();
      for (const { fields, raw } of records) {
        const out = adifRecordToContact(fields, callsign, raw);
        if (out.error) errors.push({ call: fields.CALL || '?', error: out.error });
        else if (out.contact) contacts.push(out.contact);
      }
      setParsed({ contacts, errors });
    };
    reader.readAsText(file, 'UTF-8');
  }, [file, profile?.callsign]);

  const handleUpload = async () => {
    if (!parsed?.contacts?.length) return;
    setUploading(true);
    setResult(null);
    let inserted = 0;
    let failed = 0;
    let errorMessage = null;
    for (let i = 0; i < parsed.contacts.length; i += BATCH_SIZE) {
      const batch = parsed.contacts.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('contacts').insert(batch);
      if (error) {
        failed += batch.length;
        errorMessage = error.message || error.code || String(error);
        console.error('Upload batch error:', error);
      } else {
        inserted += batch.length;
      }
    }
    setResult({ inserted, failed, errorMessage });
    setUploading(false);
  };

  if (loading) {
    return <div className="upload-page"><p className="upload-message">Loading…</p></div>;
  }
  if (!user) {
    return (
      <div className="upload-page">
        <p className="upload-message upload-error">You must be signed in to upload ADIF files.</p>
      </div>
    );
  }
  if (!profile?.callsign?.trim()) {
    return (
      <div className="upload-page">
        <p className="upload-message upload-error">Set your callsign in Settings before uploading. Uploads will be attributed to your callsign.</p>
      </div>
    );
  }

  return (
    <div className="upload-page">
      <h2 className="upload-title">Upload ADIF</h2>
      <p className="upload-desc">Upload a recent ADIF file to add contacts to the map. Max size: 5MB. Contacts will be attributed to your callsign ({profile.callsign}).</p>

      <div className="upload-controls">
        <input
          type="file"
          accept=".adi,.adif,.ADI,.ADIF,text/plain"
          onChange={handleFileChange}
          className="upload-input"
          id="adif-file"
        />
        <label htmlFor="adif-file" className="upload-label">Choose ADIF file</label>
      </div>

      {fileError && <p className="upload-message upload-error">{fileError}</p>}

      {parsed && (
        <>
          <div className="upload-summary">
            <span>Parsed: {parsed.contacts.length} contact(s)</span>
            {parsed.errors.length > 0 && (
              <span className="upload-err-count">, {parsed.errors.length} skipped (e.g. missing CALL)</span>
            )}
          </div>
          {parsed.errors.length > 0 && parsed.errors.length <= 10 && (
            <ul className="upload-err-list">
              {parsed.errors.map((e, i) => (
                <li key={i}>{e.call}: {e.error}</li>
              ))}
            </ul>
          )}
          {parsed.contacts.length > 0 && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="upload-btn"
            >
              {uploading ? 'Uploading…' : `Upload ${parsed.contacts.length} contact(s)`}
            </button>
          )}
        </>
      )}

      {result && (
        <div className="upload-result">
          <p className={`upload-message ${result.failed > 0 ? 'upload-error' : 'upload-success'}`}>
            Done. Inserted: {result.inserted}. {result.failed > 0 ? `Failed: ${result.failed}.` : ''}
          </p>
          {result.errorMessage && (
            <p className="upload-message upload-error upload-err-detail">{result.errorMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
