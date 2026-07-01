import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function Magnetic({ children, tolerance = 35 }) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    
    const distanceX = clientX - centerX;
    const distanceY = clientY - centerY;

    // Calculate distance from center
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    
    // If pointer is within tolerance boundary, pull the element towards cursor
    if (distance < tolerance + Math.max(width, height) / 2) {
      const pullStrength = 0.35; // 35% magnetic pull strength
      setPosition({ x: distanceX * pullStrength, y: distanceY * pullStrength });
    } else {
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }}
      style={{ display: 'inline-block' }}
    >
      {children}
    </motion.div>
  );
}
