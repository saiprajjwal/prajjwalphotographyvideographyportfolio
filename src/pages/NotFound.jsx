import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Camera } from 'lucide-react';
import './NotFound.css';

export default function NotFound() {
  return (
    <motion.main
      className="nf-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p className="nf-code">404</p>
      <h1 className="nf-title">This frame doesn&rsquo;t exist</h1>
      <p className="nf-sub">The page you&rsquo;re looking for was moved, renamed, or never shot.</p>
      <div className="nf-actions">
        <Link to="/" className="nf-btn nf-btn-primary">
          <Home size={18} /> Back to Home
        </Link>
        <Link to="/portfolio" className="nf-btn nf-btn-ghost">
          <Camera size={18} /> View Portfolio
        </Link>
      </div>
    </motion.main>
  );
}
