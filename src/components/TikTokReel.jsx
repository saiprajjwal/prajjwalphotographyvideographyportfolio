import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import './TikTokReel.css';

// Row card: shows the TikTok cover (player with autoplay off) and opens the
// story viewer on click. The iframe only mounts once the card nears the
// viewport so offscreen reels don't load on initial page load.
const ROW_PLAYER_PARAMS =
  'controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0&music_info=0&description=0&rel=0&native_context_menu=0&autoplay=0&loop=0';

export default function TikTokReel({ videoId, onOpen }) {
  const cardRef = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin: '300px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  return (
    <div className="video-card tiktok-reel-card" ref={cardRef}>
      {inView && (
        <iframe
          src={`https://www.tiktok.com/player/v1/${videoId}?${ROW_PLAYER_PARAMS}`}
          className="tiktok-reel-frame"
          loading="lazy"
          allow="encrypted-media"
          title="TikTok reel"
        ></iframe>
      )}
      {/* Shield lets the card be drag-scrolled and turns a click into
          "open the story viewer" instead of hitting the player. */}
      <div className="reel-card-shield" onClick={onOpen}>
        <div className="play-button">
          <Play size={24} fill="currentColor" />
        </div>
      </div>
    </div>
  );
}
