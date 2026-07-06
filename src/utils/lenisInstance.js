// Shared handle to the app-wide Lenis smooth-scroll instance.
// App.jsx sets it when Lenis is created; components that open a full-screen
// overlay (e.g. the portfolio album modal) use it to stop/start Lenis so the
// background page doesn't scroll behind the modal. It's null when Lenis isn't
// running (reduced-motion users, or the editor route).
export const lenisInstance = { current: null };
