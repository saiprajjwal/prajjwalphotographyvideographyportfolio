import { useState, useEffect, useRef } from 'react';
import portfolioData from '../data/portfolio.json';
import './Admin.css';

const CATEGORIES = portfolioData.categories.filter((c) => c !== 'All');

// Resize + re-encode large photos in the browser before upload. Cloudinary's
// free plan rejects images over 10MB, and the site only ever displays them at
// ~1200px wide, so a huge original is wasted bytes and a slow upload. Capping
// the long edge at 2560px keeps plenty of quality headroom.
async function compressImage(file, maxSide = 2560, quality = 0.85) {
  if (!file.type.startsWith('image/')) return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // decode failed — let the server deal with the original
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  // Small enough already and a normal size? Skip re-encoding to preserve it.
  if (scale === 1 && file.size <= 8 * 1024 * 1024) { bitmap.close?.(); return file; }
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || '');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [session, setSession] = useState('');
  const [altText, setAltText] = useState('');
  // Each queued photo carries its own status: pending → optimizing → uploading
  // → done | error, so the UI can show exactly what's happening per file.
  const [queue, setQueue] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'library'
  const [libraryPhotos, setLibraryPhotos] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [editCategory, setEditCategory] = useState('');
  const [editSession, setEditSession] = useState('');

  // About Page State
  const [aboutName, setAboutName] = useState(portfolioData.about.name);
  const [aboutTagline, setAboutTagline] = useState('');
  const [aboutBio, setAboutBio] = useState('');
  const [aboutGear, setAboutGear] = useState([]);
  const [aboutEmail, setAboutEmail] = useState('');
  const [aboutHeadshot, setAboutHeadshot] = useState(null);
  
  const [savingAbout, setSavingAbout] = useState(false);

  useEffect(() => {
    fetch('/api/about')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.name) {
          setAboutName(data.name || '');
          setAboutTagline(data.about?.tagline || '');
          setAboutBio(data.about?.bio || '');
          setAboutGear(data.about?.gear || []);
          setAboutEmail(data.about?.email || '');
        }
      })
      .catch((error) => {
        console.error("Failed to load portfolio metadata:", error);
      });
  }, []);

  const fetchLibrary = async () => {
    setLoadingLibrary(true);
    try {
      const res = await fetch('/api/photos');
      const data = await res.json();
      if (data.photos) setLibraryPhotos(data.photos);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLibrary(false);
    }
  };

  useEffect(() => {
    if (token && activeTab === 'library') {
      fetchLibrary();
    }
  }, [token, activeTab]);

  const handleDeletePhoto = async (id) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;
    try {
      const res = await fetch('/api/delete-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error('Deletion failed');
      setLibraryPhotos(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSetCover = async (id, session) => {
    try {
      const res = await fetch('/api/set-cover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id, session })
      });
      if (!res.ok) throw new Error('Failed to set cover');
      // Update local state to reflect the new cover
      setLibraryPhotos(prev => prev.map(p => ({
        ...p,
        isCover: p.id === id ? true : (p.session === session ? false : p.isCover)
      })));
      alert('Album cover updated!');
    } catch (err) {
      alert(err.message);
    }
  };

  const updateCategoryName = (idx, newName) => {
    const newGear = [...aboutGear];
    newGear[idx].category = newName;
    setAboutGear(newGear);
  };

  const updateCategoryItems = (idx, text) => {
    const newGear = [...aboutGear];
    newGear[idx].items = text.split('\n');
    setAboutGear(newGear);
  };

  const addCategory = () => {
    setAboutGear([...aboutGear, { category: 'New Category', items: [] }]);
  };

  const removeCategory = (idx) => {
    setAboutGear(aboutGear.filter((_, i) => i !== idx));
  };

  const startEditing = (photo) => {
    setEditingPhoto(photo);
    setEditCategory(photo.category || CATEGORIES[0]);
    setEditSession(photo.session || '');
  };

  const saveEdit = async () => {
    if (!editingPhoto) return;
    try {
      const res = await fetch('/api/update-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: editingPhoto.id, category: editCategory, session: editSession })
      });
      if (!res.ok) throw new Error('Update failed');
      
      setLibraryPhotos(prev => prev.map(p => p.id === editingPhoto.id ? { 
        ...p, 
        category: editCategory,
        session: editSession.trim() || null 
      } : p));
      setEditingPhoto(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('admin_token', data.token);
      setToken(data.token);
      setPassword('');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken('');
  };

  // --- Upload queue management ---
  const addFiles = (fileList) => {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (incoming.length === 0) return;
    const items = incoming.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      url: URL.createObjectURL(file),
      status: 'pending',
      message: '',
    }));
    setQueue((q) => [...q, ...items]);
  };

  const removeItem = (id) => {
    setQueue((q) => {
      const item = q.find((it) => it.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return q.filter((it) => it.id !== id);
    });
  };

  const clearQueue = () => {
    setQueue((q) => { q.forEach((it) => URL.revokeObjectURL(it.url)); return []; });
  };

  const setItem = (id, patch) =>
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const pending = queue.filter((it) => it.status === 'pending' || it.status === 'error');
    if (pending.length === 0) return;

    setUploading(true);
    for (const item of pending) {
      try {
        setItem(item.id, { status: 'optimizing', message: '' });
        const optimized = await compressImage(item.file);

        setItem(item.id, { status: 'uploading' });
        const sigRes = await fetch('/api/get-upload-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ category, session, altText }),
        });
        const sigData = await sigRes.json();
        if (!sigRes.ok) throw new Error(sigData.error || 'Could not get an upload signature');

        const formData = new FormData();
        formData.append('file', optimized);
        formData.append('api_key', sigData.apiKey);
        formData.append('timestamp', sigData.timestamp);
        formData.append('signature', sigData.signature);
        formData.append('folder', sigData.folder);
        formData.append('tags', sigData.tags);
        formData.append('context', sigData.context);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`,
          { method: 'POST', body: formData }
        );
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Upload failed');

        setItem(item.id, { status: 'done' });
      } catch (err) {
        setItem(item.id, { status: 'error', message: err.message });
      }
    }
    setUploading(false);
  };

  const handleAboutSave = async (e) => {
    e.preventDefault();
    setSavingAbout(true);
    let headshotUrl = portfolioData.about.headshot;

    try {
      const currentRes = await fetch('/api/about');
      if (currentRes.ok) {
        const currentData = await currentRes.json();
        headshotUrl = currentData.headshot || headshotUrl;
      }

      if (aboutHeadshot) {
        const sigRes = await fetch('/api/get-upload-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ category: 'About', session: 'Headshot', altText: aboutName }),
        });
        const sigData = await sigRes.json();
        if (!sigRes.ok) throw new Error(sigData.error || 'Failed to get upload signature');

        const formData = new FormData();
        formData.append('file', aboutHeadshot);
        formData.append('api_key', sigData.apiKey);
        formData.append('timestamp', sigData.timestamp);
        formData.append('signature', sigData.signature);
        formData.append('folder', sigData.folder);
        formData.append('tags', sigData.tags);
        formData.append('context', sigData.context);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`,
          { method: 'POST', body: formData }
        );
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Upload failed');
        headshotUrl = uploadData.secure_url;
      }

      // Filter out any completely empty categories or empty items
      const cleanedGear = aboutGear.map(cat => ({
        category: cat.category.trim(),
        items: (cat.items || []).map(i => i.trim()).filter(Boolean)
      })).filter(cat => cat.category || cat.items.length > 0);

      const aboutPayload = {
        name: aboutName,
        bio: aboutBio,
        tagline: aboutTagline,
        email: aboutEmail,
        gear: cleanedGear,
        headshot: headshotUrl
      };

      const res = await fetch('/api/update-about', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(aboutPayload)
      });
      
      if (!res.ok) throw new Error('Failed to save about page');
      alert('About page updated successfully!');
      setAboutHeadshot(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingAbout(false);
    }
  };

  if (!token) {
    return (
      <main className="admin-wrapper">
        <form className="admin-login-form glass-panel" onSubmit={handleLogin}>
          <h1>Admin Login</h1>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn-glass" disabled={loggingIn}>
            {loggingIn ? 'Checking...' : 'Log In'}
          </button>
          {loginError && <p className="admin-error">{loginError}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="admin-wrapper">
      <div className="admin-panel glass-panel" style={{ maxWidth: activeTab === 'library' ? '1200px' : '600px' }}>
        <div className="admin-header">
          <h1>Admin Panel</h1>
          <button onClick={handleLogout} className="admin-logout-btn">Log Out</button>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => setActiveTab('upload')}>Upload</button>
          <button className={`admin-tab ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>Photo Library</button>
          <button className={`admin-tab ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>About Page</button>
        </div>

        {activeTab === 'upload' ? (
          <>
            <form onSubmit={handleUpload} className="admin-upload-form">
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </label>

          <label>
            Session / Album Name (optional)
            <input
              type="text"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              placeholder="e.g. Summer Bloom 2026, Neon Nights"
            />
          </label>

          <label>
            Description (alt text, optional)
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="e.g. Golden retriever running on the beach"
            />
          </label>

          <div
            className={`up-dropzone ${dragging ? 'is-dragging' : ''}`}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
            <svg className="up-icon" viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p className="up-drop-title">Drop photos here or click to browse</p>
            <p className="up-drop-hint">JPG, PNG or WebP · big photos are auto-optimized</p>
          </div>

          {queue.length > 0 && (() => {
            const done = queue.filter((it) => it.status === 'done').length;
            const errored = queue.filter((it) => it.status === 'error').length;
            const pct = Math.round((queue.filter((it) => it.status === 'done' || it.status === 'error').length / queue.length) * 100);
            const busy = (s) => s === 'optimizing' || s === 'uploading';
            return (
              <>
                <div className="up-queue-bar">
                  <div className="up-queue-info">
                    <strong>{queue.length}</strong> photo{queue.length > 1 ? 's' : ''}
                    {uploading ? ` · ${done + errored}/${queue.length} processed` : done > 0 ? ` · ${done} uploaded` : ''}
                    {errored > 0 && <span className="up-err-count"> · {errored} failed</span>}
                  </div>
                  {!uploading && <button type="button" className="up-clear" onClick={clearQueue}>Clear all</button>}
                </div>

                {uploading && (
                  <div className="up-progress"><div className="up-progress-fill" style={{ width: `${pct}%` }} /></div>
                )}

                <div className="up-grid">
                  {queue.map((it) => (
                    <div key={it.id} className={`up-card is-${it.status}`}>
                      <img src={it.url} alt={it.file.name} loading="lazy" />
                      <div className="up-card-overlay">
                        {busy(it.status) && <span className="up-spinner" />}
                        {it.status === 'done' && <span className="up-badge up-ok">✓</span>}
                        {it.status === 'error' && <span className="up-badge up-bad" title={it.message}>!</span>}
                        {it.status === 'pending' && !uploading && (
                          <button type="button" className="up-remove" onClick={(e) => { e.stopPropagation(); removeItem(it.id); }} aria-label="Remove">×</button>
                        )}
                      </div>
                      <span className="up-card-name">
                        {it.status === 'optimizing' ? 'Optimizing…' : it.status === 'uploading' ? 'Uploading…' : it.status === 'error' ? 'Failed' : it.file.name}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}

          <button
            type="submit"
            className="btn-glass"
            disabled={uploading || queue.filter((it) => it.status === 'pending' || it.status === 'error').length === 0}
          >
            {uploading
              ? 'Uploading…'
              : (() => {
                  const n = queue.filter((it) => it.status === 'pending' || it.status === 'error').length;
                  return n ? `Upload ${n} photo${n > 1 ? 's' : ''}` : 'Upload';
                })()}
          </button>
        </form>
          </>
        ) : activeTab === 'library' ? (
          <div className="admin-library">
            {loadingLibrary ? <p>Loading library...</p> : (
              <div className="admin-library-grid">
                {libraryPhotos.map(photo => (
                  <div key={photo.id} className="admin-library-card">
                    <img src={photo.src} alt={photo.alt} />
                    {editingPhoto?.id === photo.id ? (
                      <div className="admin-library-edit-form">
                        <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                          {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <input 
                          type="text" 
                          value={editSession} 
                          onChange={(e) => setEditSession(e.target.value)} 
                          placeholder="Album name (optional)"
                        />
                        <div className="admin-library-edit-actions">
                          <button className="save-btn" onClick={saveEdit}>Save</button>
                          <button className="cancel-btn" onClick={() => setEditingPhoto(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="admin-library-details">
                          <span className="cat-badge">{photo.category}</span>
                          <span className="session-badge">{photo.session || 'No Album'}</span>
                        </div>
                        <div className="admin-library-actions">
                          <button onClick={() => startEditing(photo)}>Edit</button>
                          {photo.session && (
                            <button 
                              className={photo.isCover ? 'cover-active' : ''} 
                              onClick={() => handleSetCover(photo.id, photo.session)}
                            >
                              {photo.isCover ? '★ Cover' : 'Set Cover'}
                            </button>
                          )}
                          <button className="delete-btn" onClick={() => handleDeletePhoto(photo.id)}>Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {libraryPhotos.length === 0 && <p>No photos found.</p>}
              </div>
            )}
          </div>
        ) : activeTab === 'about' ? (
          <form onSubmit={handleAboutSave} className="admin-upload-form">
            <label>
              Name
              <input type="text" value={aboutName} onChange={e => setAboutName(e.target.value)} required />
            </label>
            <label>
              Tagline
              <input type="text" value={aboutTagline} onChange={e => setAboutTagline(e.target.value)} />
            </label>
            <label>
              Bio
              <textarea value={aboutBio} onChange={e => setAboutBio(e.target.value)} rows="5" required />
            </label>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label>Gear List Categories</label>
              {aboutGear.map((cat, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', marginBottom: '1rem', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                    <input 
                      type="text" 
                      value={cat.category} 
                      onChange={e => updateCategoryName(idx, e.target.value)} 
                      style={{ flex: 1, margin: 0 }}
                      placeholder="Category Title (e.g. CAMERAS)"
                    />
                    <button type="button" onClick={() => removeCategory(idx)} style={{ background: '#d32f2f', margin: 0, padding: '0 1rem' }}>Remove</button>
                  </div>
                  <textarea 
                    value={(cat.items || []).join('\n')}
                    onChange={e => updateCategoryItems(idx, e.target.value)}
                    rows="5"
                    style={{ margin: 0 }}
                    placeholder="One item per line"
                  />
                </div>
              ))}
              <button type="button" onClick={addCategory} style={{ background: 'rgba(0, 240, 255, 0.1)', color: '#00f0ff', border: '1px solid #00f0ff', width: '100%' }}>+ Add New Category</button>
            </div>

            <label>
              Email
              <input type="email" value={aboutEmail} onChange={e => setAboutEmail(e.target.value)} />
            </label>
            <label>
              New Headshot Image (leave blank to keep current)
              <input type="file" accept="image/*" onChange={e => setAboutHeadshot(e.target.files[0])} />
            </label>
            <button type="submit" className="btn-glass" disabled={savingAbout}>
              {savingAbout ? 'Saving...' : 'Save About Page'}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
