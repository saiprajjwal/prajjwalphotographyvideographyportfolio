import React, { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import './DepthParallaxImage.css';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  // Bypass camera matrix for a perfect fullscreen quad
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = `
uniform sampler2D uTexture;
uniform vec2 uMouse;
uniform float uHoverState;
varying vec2 vUv;

void main() {
  // Center scale up slightly to avoid tearing at the edges during displacement
  vec2 scaleCenter = vec2(0.5);
  vec2 scaledUv = (vUv - scaleCenter) * 0.94 + scaleCenter;

  vec4 tex = texture2D(uTexture, scaledUv);
  
  // Fake depth from luminance (brightness)
  float luminance = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
  
  // Create parallax displacement. Bright areas pop more.
  vec2 displacement = uMouse * (luminance * 0.08) * uHoverState;
  
  vec4 color = texture2D(uTexture, scaledUv + displacement);
  
  gl_FragColor = color;
}
`;

const Scene = ({ src, mouse, hovered, setCanvasReady }) => {
  const materialRef = useRef();
  
  // Load texture. This will suspend until loaded.
  const texture = useTexture(src);
  
  // Set texture settings for best visual quality
  React.useEffect(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      setCanvasReady(true);
    }
  }, [texture, setCanvasReady]);

  // Animate the hover state and smooth the mouse
  const currentMouse = useRef(new THREE.Vector2(0, 0));
  const targetHover = useRef(0);
  const currentHover = useRef(0);

  useFrame(() => {
    // Smoothly interpolate mouse position
    currentMouse.current.lerp(mouse, 0.1);
    
    // Smoothly interpolate hover state
    targetHover.current = hovered ? 1 : 0;
    currentHover.current = THREE.MathUtils.lerp(currentHover.current, targetHover.current, 0.1);

    if (materialRef.current) {
      materialRef.current.uniforms.uMouse.value.copy(currentMouse.current);
      materialRef.current.uniforms.uHoverState.value = currentHover.current;
    }
  });

  const uniforms = useMemo(() => ({
    uTexture: { value: texture },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uHoverState: { value: 0 }
  }), [texture]);

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
};

export default function DepthParallaxImage({ src, srcSet, sizes, alt, className, loading }) {
  const [hovered, setHovered] = useState(false);
  const [mouse, setMouse] = useState(new THREE.Vector2(0, 0));
  const [imgLoaded, setImgLoaded] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [hasHoveredOnce, setHasHoveredOnce] = useState(false);
  const containerRef = useRef(null);

  const handleMouseEnter = () => {
    setHovered(true);
    setHasHoveredOnce(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setMouse(new THREE.Vector2(0, 0));
  };

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    setMouse(new THREE.Vector2(x, y));
  };

  // Unmount canvas if not hovered and enough time has passed to fade out
  React.useEffect(() => {
    if (!hovered && hasHoveredOnce) {
      const timer = setTimeout(() => {
        setHasHoveredOnce(false);
        setCanvasReady(false);
      }, 600); // Wait for CSS transition + extra safety margin
      return () => clearTimeout(timer);
    }
  }, [hovered, hasHoveredOnce]);

  const containerClass = `depth-parallax-container ${className || ''}`.trim();

  return (
    <div 
      className={containerClass}
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={loading}
        className="depth-parallax-img"
        onLoad={() => setImgLoaded(true)}
        draggable={false}
      />
      
      {hasHoveredOnce && imgLoaded && (
        <div className={`depth-parallax-canvas-wrapper ${hovered && canvasReady ? 'active' : ''}`}>
          <Canvas
            gl={{ antialias: false, alpha: true }}
            dpr={[1, 1.5]}
            frameloop="always"
          >
            <Suspense fallback={null}>
              <Scene src={src} mouse={mouse} hovered={hovered} setCanvasReady={setCanvasReady} />
            </Suspense>
          </Canvas>
        </div>
      )}
    </div>
  );
}
