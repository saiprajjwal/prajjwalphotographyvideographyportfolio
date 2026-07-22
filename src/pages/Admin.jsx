import { useState, useEffect, useRef, useMemo } from 'react';
import {
  LayoutDashboard,
  Upload as UploadIcon,
  Images,
  LayoutGrid,
  UserRound,
  LogOut,
  Search,
  FolderOpen,
  Tag,
  ImageOff,
  ShoppingBag,
  GalleryHorizontalEnd,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import portfolioData from '../data/portfolio.json';
import defaultStoreData from '../data/store.json';
import ArrangePanel from '../components/ArrangePanel';
import { pickCategoryCover } from '../utils/categoryCover';
import './Admin.css';

const NAV = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard, subtitle: 'At a glance' },
  { id: 'upload', label: 'Upload', Icon: UploadIcon, subtitle: 'Add new photos to your portfolio' },
  { id: 'covers', label: 'Portfolio Covers', Icon: GalleryHorizontalEnd, subtitle: 'The photo each category shows on the spinning portfolio band' },
  { id: 'library', label: 'Library', Icon: Images, subtitle: 'Manage every photo' },
  { id: 'arrange', label: 'Arrange', Icon: LayoutGrid, subtitle: 'Set album & photo order' },
  { id: 'store', label: 'Store', Icon: ShoppingBag, subtitle: 'Manage presets and LUTs' },
  { id: 'about', label: 'About', Icon: UserRound, subtitle: 'Edit your public profile' },
];

const CATEGORIES = portfolioData.categories.filter((c) => c !== 'All');

// Resize + re-encode large photos in the browser before upload. Cloudinary's
// free plan rejects images over 10MB, and the site only ever displays them at
// ~1200px wide, so a huge original is wasted bytes and a slow upload. Capping
// the long edge at 2560px keeps plenty of quality headroom.
async function compressImage(file, maxSide = 2560, quality = 0.85) {
  if (!file.type.startsWith('image/')) return file;
  
  let w, h;
  let canvasSource;
  
  try {
    if (window.createImageBitmap) {
      canvasSource = await createImageBitmap(file);
      w = canvasSource.width;
      h = canvasSource.height;
    } else {
      throw new Error('createImageBitmap not supported');
    }
  } catch (err) {
    // Fallback for older browsers or formats that createImageBitmap rejects
    canvasSource = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image decode failed'));
      img.src = URL.createObjectURL(file);
    });
    w = canvasSource.width;
    h = canvasSource.height;
  }

  const scale = Math.min(1, maxSide / Math.max(w, h));
  
  // If no resizing needed and file is already under 8MB, keep original
  if (scale === 1 && file.size <= 8 * 1024 * 1024) {
    if (canvasSource.close) canvasSource.close();
    return file;
  }

  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvasSource, 0, 0, newW, newH);
  
  if (canvasSource.close) canvasSource.close();
  if (canvasSource.src) URL.revokeObjectURL(canvasSource.src);

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  
  if (!blob) {
    if (file.size > 8 * 1024 * 1024) {
      throw new Error('Could not compress image. The file is too large (>8MB) to upload uncompressed.');
    }
    return file;
  }
  
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

  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('admin-active-tab');
    const valid = NAV.some((n) => n.id === saved);
    return valid ? saved : 'overview';
  });

  // Persist the active tab so it survives page refreshes
  useEffect(() => {
    sessionStorage.setItem('admin-active-tab', activeTab);
  }, [activeTab]);
  const [libraryPhotos, setLibraryPhotos] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  // Editable category list. Seeded from the bundled default, replaced by the
  // saved list once /api/photos responds.
  const [categories, setCategories] = useState(CATEGORIES);
  const [newCategory, setNewCategory] = useState('');
  // Which category's cover picker is open, if any
  const [pickingCoverFor, setPickingCoverFor] = useState(null);
  const [libFilter, setLibFilter] = useState('All');
  const [libSearch, setLibSearch] = useState('');
  
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

  // Store Management State
  const [storeProducts, setStoreProducts] = useState(defaultStoreData.products);
  const [loadingStore, setLoadingStore] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // 'new' or product object
  const [prodTitle, setProdTitle] = useState('');
  const [prodType, setProdType] = useState('preset');
  const [prodPrice, setProdPrice] = useState(0);
  const [prodDesc, setProdDesc] = useState('');
  const [prodLink, setProdLink] = useState('');
  const [prodBeforeFile, setProdBeforeFile] = useState(null);
  const [prodAfterFile, setProdAfterFile] = useState(null);
  const [prodBeforeUrl, setProdBeforeUrl] = useState('');
  const [prodAfterUrl, setProdAfterUrl] = useState('');

  useEffect(() => {
    fetch('/api/about')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.name) {
          setAboutName(data.name || '');
          setAboutTagline(data.tagline || '');
          setAboutBio(data.bio || '');
          setAboutGear(data.gear || []);
          setAboutEmail(data.email || '');
        }
      })
      .catch((error) => {
        console.error("Failed to load portfolio metadata:", error);
      });
  }, []);

  const fetchStore = async () => {
    setLoadingStore(true);
    try {
      const res = await fetch('/api/store');
      if (res.ok) {
        const data = await res.json();
        if (data.products) setStoreProducts(data.products);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStore(false);
    }
  };

  useEffect(() => {
    if (token && (activeTab === 'store' || activeTab === 'overview')) {
      fetchStore();
    }
  }, [token, activeTab]);

  const fetchLibrary = async () => {
    setLoadingLibrary(true);
    try {
      const res = await fetch('/api/photos');
      const data = await res.json();
      if (data.photos) setLibraryPhotos(data.photos);
      // null until the list has been saved once — keep the bundled default
      if (Array.isArray(data.categories) && data.categories.length) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLibrary(false);
    }
  };

  useEffect(() => {
    if (token && (activeTab === 'library' || activeTab === 'overview' || activeTab === 'covers')) {
      fetchLibrary();
    }
  }, [token, activeTab]);

  // ── Category list ───────────────────────────────────────────
  // Persisted through POST /api/photos. Saving replaces the whole list, so
  // every mutation below goes through this one function.
  const saveCategories = async (next) => {
    const previous = categories;
    setCategories(next);                       // optimistic
    try {
      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ categories: next })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save categories');
    } catch (err) {
      setCategories(previous);                 // roll back so the UI can't lie
      alert(err.message);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      alert(`"${name}" already exists.`);
      return;
    }
    setNewCategory('');
    await saveCategories([...categories, name]);
  };

  const handleRemoveCategory = async (name) => {
    const count = libraryPhotos.filter((p) => p.category === name).length;
    const warning = count
      ? `"${name}" still has ${count} photo${count === 1 ? '' : 's'}. Removing it only hides the category — the photos stay in your library and keep their tag. Continue?`
      : `Remove "${name}"?`;
    if (!confirm(warning)) return;
    await saveCategories(categories.filter((c) => c !== name));
  };

  const moveCategory = async (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    await saveCategories(next);
  };

  // Live stats for the Overview view, derived from the fetched library.
  const stats = useMemo(() => {
    const sessions = new Set();
    const covered = new Set();
    const cats = new Set();
    for (const p of libraryPhotos) {
      if (p.category) cats.add(p.category);
      if (p.session) {
        sessions.add(p.session);
        if (p.isCover) covered.add(p.session);
      }
    }
    return {
      photos: libraryPhotos.length,
      albums: sessions.size,
      categories: cats.size,
      missingCover: sessions.size - covered.size,
    };
  }, [libraryPhotos]);

  const filteredLibrary = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    return libraryPhotos.filter((p) => {
      if (libFilter !== 'All' && p.category !== libFilter) return false;
      if (!q) return true;
      return (
        (p.session || '').toLowerCase().includes(q) ||
        (p.alt || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      );
    });
  }, [libraryPhotos, libFilter, libSearch]);

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

  // Chooses the image a category shows on the portfolio hero band. Distinct
  // from the album cover above: this is one photo per category, not per album.
  // Shares /api/set-cover — sending `category` instead of `session` selects
  // hero mode. They're one endpoint because Vercel's Hobby plan caps this
  // deployment at 12 Serverless Functions and we're exactly at it.
  const handleSetHero = async (id, category) => {
    try {
      const res = await fetch('/api/set-cover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id, category })
      });
      if (!res.ok) throw new Error('Failed to set portfolio hero');
      // Only one hero per category, so clear the flag across that category
      setLibraryPhotos(prev => prev.map(p => ({
        ...p,
        isHero: p.id === id ? true : (p.category === category ? false : p.isHero)
      })));
      alert(`"${category}" will now show this photo on the portfolio hero.`);
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

  const uploadStoreImage = async (file, fieldName, productName) => {
    const sigRes = await fetch('/api/get-upload-signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category: 'Store', session: fieldName, altText: productName }),
    });
    const sigData = await sigRes.json();
    if (!sigRes.ok) throw new Error(sigData.error || 'Failed to get upload signature');

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
    return uploadData.secure_url;
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setSavingStore(true);
    try {
      let finalBeforeUrl = prodBeforeUrl;
      let finalAfterUrl = prodAfterUrl;

      if (prodBeforeFile) {
        finalBeforeUrl = await uploadStoreImage(prodBeforeFile, 'BeforeImage', prodTitle);
      }
      if (prodAfterFile) {
        finalAfterUrl = await uploadStoreImage(prodAfterFile, 'AfterImage', prodTitle);
      }

      const productPayload = {
        id: editingProduct === 'new' ? Date.now().toString() : editingProduct.id,
        title: prodTitle,
        type: prodType,
        price: Number(prodPrice),
        currency: '$',
        description: prodDesc,
        beforeImage: finalBeforeUrl,
        afterImage: finalAfterUrl,
        link: prodLink
      };

      let updatedProducts = [];
      if (editingProduct === 'new') {
        updatedProducts = [...storeProducts, productPayload];
      } else {
        updatedProducts = storeProducts.map(p => p.id === editingProduct.id ? productPayload : p);
      }

      const res = await fetch('/api/update-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ products: updatedProducts })
      });

      if (!res.ok) throw new Error('Failed to save store data');
      
      setStoreProducts(updatedProducts);
      setEditingProduct(null);
      clearProductForm();
      alert('Product saved successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingStore(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    setSavingStore(true);
    try {
      const updatedProducts = storeProducts.filter(p => p.id !== id);
      const res = await fetch('/api/update-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ products: updatedProducts })
      });

      if (!res.ok) throw new Error('Failed to delete product');

      setStoreProducts(updatedProducts);
      alert('Product deleted successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingStore(false);
    }
  };

  const startEditingProduct = (product) => {
    setEditingProduct(product);
    setProdTitle(product.title);
    setProdType(product.type);
    setProdPrice(product.price);
    setProdDesc(product.description);
    setProdLink(product.link);
    setProdBeforeUrl(product.beforeImage);
    setProdAfterUrl(product.afterImage);
    setProdBeforeFile(null);
    setProdAfterFile(null);
  };

  const startAddingProduct = () => {
    setEditingProduct('new');
    setProdTitle('');
    setProdType('preset');
    setProdPrice(0);
    setProdDesc('');
    setProdLink('');
    setProdBeforeUrl('');
    setProdAfterUrl('');
    setProdBeforeFile(null);
    setProdAfterFile(null);
  };

  const clearProductForm = () => {
    setProdTitle('');
    setProdType('preset');
    setProdPrice(0);
    setProdDesc('');
    setProdLink('');
    setProdBeforeUrl('');
    setProdAfterUrl('');
    setProdBeforeFile(null);
    setProdAfterFile(null);
  };

  if (!token) {
    return (
      <main className="admin-wrapper">
        <form className="admin-login-form glass-panel" onSubmit={handleLogin}>
          <div className="admin-login-brand">
            <span className="admin-brand-mark">P</span>
            <div>
              <strong>Studio Admin</strong>
              <span>Prajjwal Pandey Photography</span>
            </div>
          </div>
          <label className="admin-field">
            Password
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </label>
          <button type="submit" className="btn-glass admin-primary-btn" disabled={loggingIn}>
            {loggingIn ? 'Checking…' : 'Log In'}
          </button>
          {loginError && <p className="admin-error" role="alert">{loginError}</p>}
        </form>
      </main>
    );
  }

  const currentView = NAV.find((n) => n.id === activeTab) || NAV[0];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">P</span>
          <div className="admin-brand-text">
            <strong>Studio Admin</strong>
            <span>Prajjwal Pandey</span>
          </div>
        </div>
        <nav className="admin-nav">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`admin-nav-item ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-title">
            <h1>{currentView.label}</h1>
            <p>{currentView.subtitle}</p>
          </div>
          <button onClick={handleLogout} className="admin-logout-btn">
            <LogOut size={16} strokeWidth={1.8} />
            <span>Log Out</span>
          </button>
        </header>

        <div className="admin-content">
          {activeTab === 'overview' && (
            <div className="ov">
              <div className="ov-stats">
                {[
                  { key: 'photos', label: 'Photos', Icon: Images, value: stats.photos },
                  { key: 'albums', label: 'Albums', Icon: FolderOpen, value: stats.albums },
                  { key: 'categories', label: 'Categories', Icon: Tag, value: stats.categories },
                  { key: 'missing', label: 'Albums without a cover', Icon: ImageOff, value: stats.missingCover, warn: stats.missingCover > 0 },
                ].map(({ key, label, Icon, value, warn }) => (
                  <div key={key} className={`ov-stat ${warn ? 'is-warn' : ''} ${loadingLibrary && libraryPhotos.length === 0 ? 'is-loading' : ''}`}>
                    <span className="ov-stat-icon"><Icon size={20} strokeWidth={1.8} /></span>
                    <span className="ov-stat-value">{value}</span>
                    <span className="ov-stat-label">{label}</span>
                  </div>
                ))}
              </div>

              <div className="ov-actions">
                <button className="ov-action" onClick={() => setActiveTab('upload')}>
                  <UploadIcon size={18} strokeWidth={1.8} /> Upload photos
                </button>
                <button className="ov-action" onClick={() => setActiveTab('arrange')}>
                  <LayoutGrid size={18} strokeWidth={1.8} /> Arrange albums
                </button>
                <button className="ov-action" onClick={() => setActiveTab('library')}>
                  <Images size={18} strokeWidth={1.8} /> Manage library
                </button>
              </div>

              <section className="ov-recent">
                <div className="ov-section-head">
                  <h2>Recent uploads</h2>
                  <button className="ov-link" onClick={() => setActiveTab('library')}>View all →</button>
                </div>
                {libraryPhotos.length === 0 ? (
                  <p className="admin-empty">
                    {loadingLibrary ? 'Loading your library…' : 'No photos yet — head to Upload to add your first shots.'}
                  </p>
                ) : (
                  <div className="ov-recent-grid">
                    {libraryPhotos.slice(0, 8).map((p) => (
                      <div key={p.id} className="ov-thumb">
                        <img src={p.src} alt={p.alt} loading="lazy" />
                        {p.session && <span className="ov-thumb-badge">{p.session}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'upload' && (
            <form onSubmit={handleUpload} className="admin-upload-form">
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((cat) => (
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
          )}

          {activeTab === 'covers' && (
            <div className="cov">
              <p className="cov-intro">
                The Portfolio page opens with a spinning band of category images.
                This is where you choose which photo each category shows there.
                Categories added here also appear in the Upload dropdown and as
                filters on the Portfolio page.
              </p>

              <form className="cov-add" onSubmit={handleAddCategory}>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="New category name — e.g. Weddings"
                  aria-label="New category name"
                />
                <button type="submit" className="cov-add-btn">
                  <Plus size={15} strokeWidth={2} />
                  <span>Add category</span>
                </button>
              </form>

              {loadingLibrary ? (
                <p className="cov-loading">Loading your photos…</p>
              ) : (
                <div className="cov-list">
                  {categories.map((cat, index) => {
                    const inCategory = libraryPhotos.filter((p) => p.category === cat);
                    // Same helper the live band uses, so this preview matches
                    const shown = pickCategoryCover(inCategory);
                    const explicit = inCategory.some((p) => p.isHero);

                    return (
                      <div className="cov-card" key={cat}>
                        <div className="cov-thumb">
                          {shown ? (
                            <img src={shown.src} alt={`${cat} cover`} />
                          ) : (
                            <span className="cov-thumb-empty">No photos yet</span>
                          )}
                        </div>

                        <div className="cov-body">
                          <div className="cov-head">
                            <h3>{cat}</h3>
                            <span className="cov-meta">
                              {inCategory.length} photo{inCategory.length === 1 ? '' : 's'}
                              {' · '}
                              {explicit ? 'cover chosen' : 'using default'}
                            </span>
                          </div>

                          <div className="cov-actions">
                            <button
                              type="button"
                              onClick={() => setPickingCoverFor(pickingCoverFor === cat ? null : cat)}
                              disabled={inCategory.length === 0}
                            >
                              {pickingCoverFor === cat ? 'Close' : 'Change cover'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setCategory(cat); setActiveTab('upload'); }}
                            >
                              Upload photo
                            </button>
                            <button
                              type="button"
                              className="cov-icon-btn"
                              onClick={() => moveCategory(index, -1)}
                              disabled={index === 0}
                              aria-label={`Move ${cat} up`}
                            >
                              <ChevronUp size={15} strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              className="cov-icon-btn"
                              onClick={() => moveCategory(index, 1)}
                              disabled={index === categories.length - 1}
                              aria-label={`Move ${cat} down`}
                            >
                              <ChevronDown size={15} strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              className="cov-icon-btn cov-danger"
                              onClick={() => handleRemoveCategory(cat)}
                              aria-label={`Remove ${cat}`}
                            >
                              <Trash2 size={15} strokeWidth={2} />
                            </button>
                          </div>

                          {pickingCoverFor === cat && (
                            <div className="cov-picker">
                              {inCategory.map((photo) => (
                                <button
                                  type="button"
                                  key={photo.id}
                                  className={`cov-pick ${photo.isHero ? 'is-current' : ''}`}
                                  onClick={async () => {
                                    await handleSetHero(photo.id, cat);
                                    setPickingCoverFor(null);
                                  }}
                                  title={photo.session || 'No album'}
                                >
                                  <img src={photo.src} alt={photo.alt} loading="lazy" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'library' && (
          <div className="admin-library">
            <div className="lib-controls">
              <div className="lib-search">
                <Search size={16} strokeWidth={1.8} />
                <input
                  type="text"
                  value={libSearch}
                  onChange={(e) => setLibSearch(e.target.value)}
                  placeholder="Search album, category or description…"
                />
              </div>
              <div className="lib-chips">
                {['All', ...categories].map((c) => (
                  <button
                    key={c}
                    className={`lib-chip ${libFilter === c ? 'active' : ''}`}
                    onClick={() => setLibFilter(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {loadingLibrary ? (
              <div className="admin-library-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="admin-library-card is-skeleton" />
                ))}
              </div>
            ) : filteredLibrary.length === 0 ? (
              <p className="admin-empty">
                {libraryPhotos.length === 0 ? 'No photos found.' : 'No photos match your filters.'}
              </p>
            ) : (
              <div className="admin-library-grid">
                {filteredLibrary.map(photo => (
                  <div key={photo.id} className="admin-library-card">
                    <img src={photo.src} alt={photo.alt} />
                    {editingPhoto?.id === photo.id ? (
                      <div className="admin-library-edit-form">
                        <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
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
                              title={`Use as the cover of the "${photo.session}" album`}
                            >
                              {photo.isCover ? '★ Cover' : 'Set Cover'}
                            </button>
                          )}
                          {/* Read-only marker. Choosing the cover lives in the
                              Portfolio Covers tab, where you can see every
                              category's current image side by side. */}
                          {photo.isHero && (
                            <span className="hero-badge" title={`Shown for "${photo.category}" on the portfolio band`}>
                              ◆ Portfolio cover
                            </span>
                          )}
                          <button className="delete-btn" onClick={() => handleDeletePhoto(photo.id)}>Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {activeTab === 'arrange' && (
            <ArrangePanel token={token} categories={categories} />
          )}

          {activeTab === 'store' && (
            <div className="admin-store">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>Products Directory</h2>
                {!editingProduct && (
                  <button onClick={startAddingProduct} className="btn-glass" style={{ margin: 0 }}>
                    + Add New Product
                  </button>
                )}
              </div>

              {editingProduct ? (
                <form onSubmit={handleSaveProduct} className="admin-upload-form glass-panel" style={{ padding: '2rem' }}>
                  <h3>{editingProduct === 'new' ? 'New Product Details' : `Edit: ${prodTitle}`}</h3>
                  
                  <label>
                    Product Title
                    <input type="text" value={prodTitle} onChange={e => setProdTitle(e.target.value)} required />
                  </label>

                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <label style={{ flex: 1 }}>
                      Product Type
                      <select value={prodType} onChange={e => setProdType(e.target.value)}>
                        <option value="preset">Preset</option>
                        <option value="lut">LUT</option>
                      </select>
                    </label>
                    <label style={{ flex: 1 }}>
                      Price (USD)
                      <input type="number" value={prodPrice} onChange={e => setProdPrice(e.target.value)} min="0" required />
                    </label>
                  </div>

                  <label>
                    Description
                    <textarea value={prodDesc} onChange={e => setProdDesc(e.target.value)} rows="4" required />
                  </label>

                  <label>
                    Gumroad/Lemon Squeezy Link
                    <input type="url" value={prodLink} onChange={e => setProdLink(e.target.value)} placeholder="https://gumroad.com/..." required />
                  </label>

                  <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <label>
                        Before Image (Unedited)
                        {prodBeforeUrl && <img src={prodBeforeUrl} alt="Before Preview" style={{ width: '100px', height: '60px', objectFit: 'cover', margin: '0.5rem 0', borderRadius: '4px', display: 'block' }} />}
                        <input type="file" accept="image/*" onChange={e => setProdBeforeFile(e.target.files[0])} required={editingProduct === 'new'} />
                      </label>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label>
                        After Image (Edited)
                        {prodAfterUrl && <img src={prodAfterUrl} alt="After Preview" style={{ width: '100px', height: '60px', objectFit: 'cover', margin: '0.5rem 0', borderRadius: '4px', display: 'block' }} />}
                        <input type="file" accept="image/*" onChange={e => setProdAfterFile(e.target.files[0])} required={editingProduct === 'new'} />
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="submit" className="btn-glass" disabled={savingStore} style={{ margin: 0, flex: 1 }}>
                      {savingStore ? 'Saving Product…' : 'Save Product'}
                    </button>
                    <button type="button" onClick={() => setEditingProduct(null)} className="cancel-btn" style={{ margin: 0 }}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="admin-library-grid">
                  {storeProducts.map(product => (
                    <div key={product.id} className="admin-library-card">
                      <img src={product.afterImage} alt={product.title} />
                      <div className="admin-library-details">
                        <span className="cat-badge">{product.type.toUpperCase()}</span>
                        <span className="session-badge">{product.price === 0 ? 'FREE' : `$${product.price}`}</span>
                      </div>
                      <div style={{ padding: '0 1rem 1rem' }}>
                        <h4 style={{ margin: '0.5rem 0', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.title}</h4>
                      </div>
                      <div className="admin-library-actions">
                        <button onClick={() => startEditingProduct(product)}>Edit</button>
                        <button className="delete-btn" onClick={() => handleDeleteProduct(product.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                  {storeProducts.length === 0 && (
                    <p className="admin-empty">No products yet. Click "+ Add New Product" to create one.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'about' && (
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
                    <button type="button" onClick={() => removeCategory(idx)} style={{ background: '#d32f2f', margin: 0, padding: '0.6rem 1.2rem', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: '500' }}>Remove</button>
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
              <button type="button" onClick={addCategory} style={{ background: 'rgba(0, 240, 255, 0.1)', color: '#00f0ff', border: '1px solid #00f0ff', width: '100%', padding: '0.7rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>+ Add New Category</button>
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
              {savingAbout ? 'Saving…' : 'Save About Page'}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
