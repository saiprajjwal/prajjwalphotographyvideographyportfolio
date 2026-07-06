import { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './ArrangePanel.css';

// Unset order (0) sorts last; explicit 1,2,3… lead. Matches Portfolio.jsx.
const rank = (v) => (v > 0 ? v : Infinity);

function SortableCard({ id, img, title, subtitle, badge, onOpen, useHandle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : 1,
  };
  // Album cards get a dedicated handle so the rest of the card stays clickable
  // (to drill into the album). Photo cards are draggable anywhere.
  const dragProps = useHandle ? {} : { ...attributes, ...listeners };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`arr-card ${isDragging ? 'is-dragging' : ''}`}
      {...dragProps}
    >
      <span className="arr-badge">{badge}</span>
      {useHandle && (
        <button
          type="button"
          className="arr-handle"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      )}
      <img src={img} alt={title} draggable={false} />
      <div className="arr-card-meta">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
        {onOpen && (
          <button type="button" className="arr-open" onClick={onOpen}>
            Arrange photos →
          </button>
        )}
      </div>
    </div>
  );
}

export default function ArrangePanel({ token, categories }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(categories[0] || '');
  const [openAlbum, setOpenAlbum] = useState(null);

  const [albumSeq, setAlbumSeq] = useState([]); // ordered array of session names
  const [photoSeq, setPhotoSeq] = useState([]); // ordered array of photo objects
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/photos');
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch {
      setStatus('Could not load photos.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const categoryPhotos = useMemo(
    () => photos.filter((p) => p.category === category),
    [photos, category]
  );

  // Distinct albums in this category, each with its cover + count, order-sorted.
  const albums = useMemo(() => {
    const map = new Map();
    for (const p of categoryPhotos) {
      if (!p.session) continue;
      if (!map.has(p.session)) {
        map.set(p.session, {
          session: p.session,
          cover: p,
          count: 0,
          order: p.albumOrder,
        });
      }
      const a = map.get(p.session);
      a.count += 1;
      if (p.isCover) a.cover = p;
    }
    return [...map.values()].sort((a, b) => rank(a.order) - rank(b.order));
  }, [categoryPhotos]);

  const albumMap = useMemo(
    () => Object.fromEntries(albums.map((a) => [a.session, a])),
    [albums]
  );

  // Reset the working album sequence whenever the source data/category changes.
  // Status is deliberately left alone here so a "saved ✓" note survives the
  // re-render that a successful save triggers; navigation clears it instead.
  useEffect(() => {
    setAlbumSeq(albums.map((a) => a.session));
    setDirty(false);
  }, [albums]);

  const openAlbumPhotos = useMemo(() => {
    if (!openAlbum) return [];
    return categoryPhotos
      .filter((p) => p.session === openAlbum)
      .sort((a, b) => rank(a.photoOrder) - rank(b.photoOrder));
  }, [categoryPhotos, openAlbum]);

  useEffect(() => {
    setPhotoSeq(openAlbumPhotos);
    setDirty(false);
  }, [openAlbumPhotos]);

  const guardUnsaved = () => {
    if (!dirty) return true;
    return window.confirm('You have unsaved order changes. Discard them?');
  };

  const changeCategory = (next) => {
    if (!guardUnsaved()) return;
    setStatus('');
    setCategory(next);
    setOpenAlbum(null);
  };

  const openAlbumView = (session) => {
    if (!guardUnsaved()) return;
    setStatus('');
    setOpenAlbum(session);
  };

  const closeAlbumView = () => {
    if (!guardUnsaved()) return;
    setStatus('');
    setOpenAlbum(null);
  };

  const onAlbumDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setAlbumSeq((items) =>
      arrayMove(items, items.indexOf(active.id), items.indexOf(over.id))
    );
    setStatus('');
    setDirty(true);
  };

  const onPhotoDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setPhotoSeq((items) => {
      const oldIndex = items.findIndex((p) => p.id === active.id);
      const newIndex = items.findIndex((p) => p.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
    setStatus('');
    setDirty(true);
  };

  const postReorder = async (type, updates) => {
    const res = await fetch('/api/reorder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type, updates }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Save failed');
    }
  };

  const saveAlbums = async () => {
    setSaving(true);
    setStatus('');
    try {
      const updates = albumSeq.map((session, i) => ({ session, order: i + 1 }));
      await postReorder('albums', updates);
      // Reflect new album_order locally so the memoised order stays in sync
      // without a full refetch.
      const orderBySession = Object.fromEntries(
        albumSeq.map((s, i) => [s, i + 1])
      );
      setPhotos((prev) =>
        prev.map((p) =>
          p.session in orderBySession
            ? { ...p, albumOrder: orderBySession[p.session] }
            : p
        )
      );
      setDirty(false);
      setStatus('Album order saved ✓');
    } catch (e) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  };

  const savePhotos = async () => {
    setSaving(true);
    setStatus('');
    try {
      const updates = photoSeq.map((p, i) => ({ id: p.id, order: i + 1 }));
      await postReorder('photos', updates);
      const orderById = Object.fromEntries(photoSeq.map((p, i) => [p.id, i + 1]));
      setPhotos((prev) =>
        prev.map((p) =>
          p.id in orderById ? { ...p, photoOrder: orderById[p.id] } : p
        )
      );
      setDirty(false);
      setStatus('Photo order saved ✓');
    } catch (e) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="arr-hint">Loading library…</p>;

  return (
    <div className="arrange-panel">
      <div className="arr-toolbar">
        {openAlbum ? (
          <button type="button" className="arr-back" onClick={closeAlbumView}>
            ← Albums
          </button>
        ) : (
          <label className="arr-cat">
            Category
            <select
              value={category}
              onChange={(e) => changeCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="arr-breadcrumb">
          {category}
          {openAlbum ? ` / ${openAlbum}` : ''}
        </div>
      </div>

      <p className="arr-hint">
        {openAlbum
          ? 'Drag photos to set their order inside this album. The first photo shows first.'
          : 'Drag the ⠿ handle to reorder albums. The number is its position on the site.'}
      </p>

      {(dirty || status) && (
        <div className={`arr-savebar ${dirty ? 'is-dirty' : ''}`}>
          <span>{status || 'Unsaved order changes'}</span>
          {dirty && (
            <button
              type="button"
              className="arr-save"
              disabled={saving}
              onClick={openAlbum ? savePhotos : saveAlbums}
            >
              {saving ? 'Saving…' : 'Save order'}
            </button>
          )}
        </div>
      )}

      {openAlbum ? (
        photoSeq.length === 0 ? (
          <p className="arr-hint">This album has no photos.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onPhotoDragEnd}
          >
            <SortableContext
              items={photoSeq.map((p) => p.id)}
              strategy={rectSortingStrategy}
            >
              <div className="arr-grid">
                {photoSeq.map((p, i) => (
                  <SortableCard
                    key={p.id}
                    id={p.id}
                    img={p.src}
                    title={p.isCover ? '★ Cover' : `#${i + 1}`}
                    badge={i + 1}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )
      ) : albumSeq.length === 0 ? (
        <p className="arr-hint">
          No albums in this category yet. Give photos a Session / Album name when
          uploading to group them here.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onAlbumDragEnd}
        >
          <SortableContext items={albumSeq} strategy={rectSortingStrategy}>
            <div className="arr-grid">
              {albumSeq.map((session, i) => {
                const a = albumMap[session];
                if (!a) return null;
                return (
                  <SortableCard
                    key={session}
                    id={session}
                    img={a.cover.src}
                    title={session}
                    subtitle={`${a.count} photo${a.count > 1 ? 's' : ''}`}
                    badge={i + 1}
                    useHandle
                    onOpen={() => openAlbumView(session)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
