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
      
      let targetX = distanceX * pullStrength;
      let targetY = distanceY * pullStrength;
      
      // Clamp displacement to a maximum of 15px so large mobile menu blocks don't fly out of bounds
      const maxDisplacement = 15;
      targetX = Math.max(Math.min(targetX, maxDisplacement), -maxDisplacement);
      targetY = Math.max(Math.min(targetY, maxDisplacement), -maxDisplacement);

      setPosition({ x: targetX, y: targetY });
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
      className="magnetic-wrapper"
    >
      {children}
    </motion.div>
  );
}
