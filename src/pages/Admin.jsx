import { useState, useEffect } from 'react';
import portfolioData from '../data/portfolio.json';
import './Admin.css';

const CATEGORIES = portfolioData.categories.filter((c) => c !== 'All');

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || '');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [session, setSession] = useState('');
  const [altText, setAltText] = useState('');
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'library'
  const [libraryPhotos, setLibraryPhotos] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [editCategory, setEditCategory] = useState('');
  const [editSession, setEditSession] = useState('');

  // About Page State
  const [aboutName, setAboutName] = useState(portfolioData.about.name);
  const [aboutBio, setAboutBio] = useState(portfolioData.about.bio);
  const [aboutTagline, setAboutTagline] = useState(portfolioData.about.tagline);
  const [aboutGear, setAboutGear] = useState(portfolioData.about.gear.join(', '));
  const [aboutEmail, setAboutEmail] = useState(portfolioData.about.email);
  const [aboutHeadshot, setAboutHeadshot] = useState(null);
  const [savingAbout, setSavingAbout] = useState(false);

  useEffect(() => {
    fetch('/api/about')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.name) {
          setAboutName(data.name || '');
          setAboutBio(data.bio || '');
          setAboutTagline(data.tagline || '');
          setAboutGear((data.gear || []).join(', '));
          setAboutEmail(data.email || '');
        }
      })
      .catch(() => {});
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

  const handleUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    const newResults = [];

    for (const file of files) {
      try {
        const sigRes = await fetch('/api/get-upload-signature', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ category, session, altText }),
        });
        const sigData = await sigRes.json();
        if (!sigRes.ok) throw new Error(sigData.error || 'Could not get an upload signature');

        const formData = new FormData();
        formData.append('file', file);
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

        newResults.push({ file: file.name, status: 'success' });
      } catch (err) {
        newResults.push({ file: file.name, status: 'error', message: err.message });
      }
    }

    setResults(newResults);
    setFiles([]);
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

      let parsedGear = [];
      try {
        parsedGear = typeof aboutGear === 'string' ? JSON.parse(aboutGear) : aboutGear;
      } catch (err) {
        throw new Error('Gear must be valid JSON format');
      }

      const aboutPayload = {
        name: aboutName,
        bio: aboutBio,
        tagline: aboutTagline,
        email: aboutEmail,
        gear: parsedGear,
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

          <label>
            Photos
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files))}
            />
          </label>

          <button type="submit" className="btn-glass" disabled={uploading || files.length === 0}>
            {uploading ? 'Uploading...' : `Upload ${files.length || ''}`.trim()}
          </button>
        </form>

        {results.length > 0 && (
          <ul className="admin-results">
            {results.map((r, i) => (
              <li key={i} className={r.status}>
                {r.status === 'success' ? `✓ ${r.file}` : `✗ ${r.file} — ${r.message}`}
              </li>
            ))}
          </ul>
        )}
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
        ) : (
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
            <label>
              Gear (JSON format)
              <textarea 
                value={typeof aboutGear === 'string' ? aboutGear : JSON.stringify(aboutGear, null, 2)} 
                onChange={e => setAboutGear(e.target.value)} 
                rows="15" 
                style={{ fontFamily: 'monospace', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)' }}
              />
            </label>
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
        )}
      </div>
    </main>
  );
}
