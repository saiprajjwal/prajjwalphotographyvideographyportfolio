import './FilmGrain.css';

// Purely decorative — a fixed overlay that adds cinematic film grain and
// chromatic aberration vignetting to the entire viewport.  Costs nothing
// interactively (pointer-events: none) and is GPU-composited.
export default function FilmGrain() {
  return (
    <>
      <div className="film-grain" aria-hidden="true" />
      <div className="film-grain-ca" aria-hidden="true" />
    </>
  );
}
