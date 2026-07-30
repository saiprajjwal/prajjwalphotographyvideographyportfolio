# Animate Grid Toggle in PhotoViewer

The goal is to provide a smooth FLIP animation when toggling between the "flow" (individual scroll) and "grid" (masonry) views in the photo viewer.

## Proposed Changes

### PhotoViewer.jsx
1. **Unify the DOM Structure:** Instead of using a ternary `view === 'flow' ? ... : ...` to unmount and remount entirely different DOM structures, we will use a single `map` over `album.photos`.
2. **Framer Motion Layout:** Wrap the items in `<motion.div layout className={view === 'flow' ? 'pv-frame' : 'pv-grid-item'}>`. This tells Framer Motion to automatically calculate and animate the transition of their bounding boxes when the CSS layout changes.
3. **Always Render WebGL:** Keep `<PhotoViewerScene>` mounted in both views! The WebGL planes already track the DOM elements frame-by-frame via `getBoundingClientRect()`. By animating the DOM elements with Framer Motion, the WebGL planes will perfectly animate along with them into the masonry grid.
4. **Hide DOM Images:** Ensure the DOM images remain `opacity: 0` in both views, since WebGL will now draw the photos in both modes.

### PhotoViewerScene.jsx
1. **Disable Cloth Effect in Grid:** Pass `view` prop to the scene. If `view === 'grid'`, we force `rollStrength` to `0` so the photos stay perfectly flat when scrolling the masonry grid.
2. **Transition Roll Strength:** Use a Framer Motion `useSpring` to smoothly transition the `rollStrength` multiplier between `1` (flow) and `0` (grid) during the layout animation.

## Verification
1. I will check the dev server to confirm that clicking the toggle smoothly animates the photos into a masonry grid.
2. I will confirm that the cloth effect is disabled while in the grid view.
