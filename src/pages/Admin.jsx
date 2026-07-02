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

  const handleUpdatePhoto = async (id, category, currentSession) => {
    const newSession = window.prompt(`Update Album name for this ${category} photo (leave blank for no album):`, currentSession || '');
    if (newSession === null) return; // User cancelled
    
    try {
      const res = await fetch('/api/update-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id, category, session: newSession })
      });
      if (!res.ok) throw new Error('Update failed');
      setLibraryPhotos(prev => prev.map(p => p.id === id ? { ...p, session: newSession.trim() || null } : p));
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
        ) : (
          <div className="admin-library">
            {loadingLibrary ? <p>Loading library...</p> : (
              <div className="admin-library-grid">
                {libraryPhotos.map(photo => (
                  <div key={photo.id} className="admin-library-card">
                    <img src={photo.src} alt={photo.alt} />
                    <div className="admin-library-details">
                      <span className="cat-badge">{photo.category}</span>
                      <span className="session-badge">{photo.session || 'No Album'}</span>
                    </div>
                    <div className="admin-library-actions">
                      <button onClick={() => handleUpdatePhoto(photo.id, photo.category, photo.session)}>Edit Album</button>
                      <button className="delete-btn" onClick={() => handleDeletePhoto(photo.id)}>Delete</button>
                    </div>
                  </div>
                ))}
                {libraryPhotos.length === 0 && <p>No photos found.</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
