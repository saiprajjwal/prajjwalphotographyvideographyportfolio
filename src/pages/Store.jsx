import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Filter, Download } from 'lucide-react';
import defaultStoreData from '../data/store.json';
import ProductModal from '../components/ProductModal';
import './Store.css';

export default function Store() {
  const [filter, setFilter] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [products, setProducts] = useState(defaultStoreData.products);

  useEffect(() => {
    fetch('/api/store')
      .then(res => {
        if (!res.ok) throw new Error('Store data not found');
        return res.json();
      })
      .then(data => {
        if (data && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      })
      .catch(() => {
        // Fallback to local store data
      });
  }, []);

  const filteredProducts = products.filter(product => {
    if (filter === 'all') return true;
    if (filter === 'free') return product.price === 0;
    if (filter === 'paid') return product.price > 0;
    return product.type === filter;
  });

  const filterOptions = [
    { id: 'all', label: 'All Products' },
    { id: 'preset', label: 'Presets' },
    { id: 'lut', label: 'LUTs' },
    { id: 'free', label: 'Free' },
    { id: 'paid', label: 'Premium' }
  ];

  const handleProductClick = (product) => {
    setSelectedProduct(product);
  };

  return (
    <div className="store-page page-wrapper">
      <main className="section-padding">
        <div className="container">
          <motion.div 
            className="store-header"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1>Digital Assets</h1>
            <p className="store-subtitle">Cinematic presets and LUTs to elevate your visual storytelling.</p>
          </motion.div>

          <motion.div 
            className="store-filters"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="filter-icon">
              <Filter size={18} />
            </div>
            <div className="filter-buttons">
              {filterOptions.map(option => (
                <button
                  key={option.id}
                  className={`filter-btn ${filter === option.id ? 'active' : ''}`}
                  onClick={() => setFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div 
            className="products-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                  className="product-card glass-panel"
                >
                  <div className="product-image-container" onClick={() => handleProductClick(product)}>
                    <img src={product.afterImage} alt={product.title} loading="lazy" />
                    <div className="product-type-badge">
                      {product.type.toUpperCase()}
                    </div>
                  </div>
                  
                  <div className="product-info">
                    <h3>{product.title}</h3>
                    <p className="product-desc">{product.description}</p>
                    
                    <div className="product-footer">
                      <span className="product-price">
                        {product.price === 0 ? 'Free' : `${product.currency}${product.price}`}
                      </span>
                      <button 
                        className="buy-btn"
                        onClick={() => handleProductClick(product)}
                      >
                        {product.price === 0 ? (
                          <>
                            <Download size={18} />
                            View
                          </>
                        ) : (
                          <>
                            <ShoppingBag size={18} />
                            Details
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {filteredProducts.length === 0 && (
              <motion.div 
                className="no-products"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p>No products found for this filter.</p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>

      <ProductModal 
        product={selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
      />
    </div>
  );
}
