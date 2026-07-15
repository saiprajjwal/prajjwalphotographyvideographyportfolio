import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ShoppingBag } from 'lucide-react';
import BeforeAfterSlider from './BeforeAfterSlider';
import './ProductModal.css';

export default function ProductModal({ product, onClose }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [onClose]);

  if (!product) return null;

  const handleBuy = () => {
    window.open(product.link, '_blank');
  };

  return (
    <AnimatePresence>
      <motion.div 
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div 
          className="modal-content glass-panel"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>

          <div className="modal-slider-section">
            <BeforeAfterSlider 
              beforeImage={product.beforeImage} 
              afterImage={product.afterImage} 
            />
          </div>

          <div className="modal-details">
            <div className="modal-header">
              <span className="modal-badge">{product.type.toUpperCase()}</span>
              <h2>{product.title}</h2>
            </div>
            
            <p className="modal-description">{product.description}</p>
            
            <div className="modal-footer">
              <span className="modal-price">
                {product.price === 0 ? 'Free' : `${product.currency}${product.price}`}
              </span>
              <button className="modal-buy-btn" onClick={handleBuy}>
                {product.price === 0 ? (
                  <>
                    <Download size={18} />
                    Download Free
                  </>
                ) : (
                  <>
                    <ShoppingBag size={18} />
                    Purchase Now
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
