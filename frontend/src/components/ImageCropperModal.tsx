import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Move, Check, X, Crop } from 'lucide-react';

interface ImageCropperModalProps {
  imageSrc: string;
  cropShape: 'circle' | 'rect';
  onCrop: (croppedBase64: string) => void;
  onClose: () => void;
}

export function ImageCropperModal({ imageSrc, cropShape, onCrop, onClose }: ImageCropperModalProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const dragStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Crop dimensions based on shape
  const cropWidth = cropShape === 'circle' ? 250 : 320;
  const cropHeight = cropShape === 'circle' ? 250 : 128;

  // Calculate base fit dimensions when image loads
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;

    // Fit image to cover the crop area
    const fitScale = Math.max(cropWidth / naturalW, cropHeight / naturalH);
    setImageSize({
      width: naturalW * fitScale,
      height: naturalH * fitScale,
    });
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Dragging event handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;

    // Calculate boundary limits
    const currentW = imageSize.width * zoom;
    const currentH = imageSize.height * zoom;

    // Constrain offset to keep crop box covered by image
    const limitX = Math.max(0, (currentW - cropWidth) / 2);
    const limitY = Math.max(0, (currentH - cropHeight) / 2);

    const constrainedX = Math.min(Math.max(newX, -limitX), limitX);
    const constrainedY = Math.min(Math.max(newY, -limitY), limitY);

    setPosition({ x: constrainedX, y: constrainedY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    if (containerRef.current) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  };

  // Perform canvas cropping
  const handleApply = () => {
    const img = imageRef.current;
    if (!img || imageSize.width === 0) return;

    // Create high-res destination canvas
    const canvas = document.createElement('canvas');
    // Output size: 2x the display size for premium quality
    const outputW = cropWidth * 2;
    const outputH = cropHeight * 2;
    canvas.width = outputW;
    canvas.height = outputH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Enable high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Math: draw the image on the canvas
    const currentW = imageSize.width * zoom;
    const currentH = imageSize.height * zoom;

    // Top-left of crop box relative to container center is (-cropWidth/2, -cropHeight/2)
    // Image center is offset by (position.x, position.y)
    // Draw coordinates on destination canvas (scaled up by 2x)
    const dx = (outputW / 2) - (currentW * 2) / 2 + position.x * 2;
    const dy = (outputH / 2) - (currentH * 2) / 2 + position.y * 2;
    const dw = currentW * 2;
    const dh = currentH * 2;

    ctx.drawImage(img, dx, dy, dw, dh);

    // Output base64 data url
    const base64 = canvas.toDataURL('image/png', 0.95);
    onCrop(base64);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-150 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/30 text-brand-500 rounded-xl">
              <Crop size={18} />
            </div>
            <div>
              <h3 className="text-md font-black dark:text-white leading-tight">Crop & Apply Image</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Drag to reposition, slider to zoom</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-95 outline-none"
          >
            <X size={16} />
          </button>
        </div>

        {/* Workspace */}
        <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center select-none">
          <div 
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative overflow-hidden cursor-move bg-slate-200 dark:bg-slate-800 shadow-inner border border-slate-250 dark:border-slate-750 flex items-center justify-center"
            style={{ 
              width: '320px', 
              height: '320px',
              borderRadius: cropShape === 'circle' ? '2.5rem' : '1.5rem'
            }}
          >
            {/* Draggable/Zoomable Image */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Source crop"
              onLoad={handleImageLoad}
              className="absolute pointer-events-none max-w-none origin-center"
              style={{
                width: imageSize.width ? `${imageSize.width * zoom}px` : 'auto',
                height: imageSize.height ? `${imageSize.height * zoom}px` : 'auto',
                transform: `translate(${position.x}px, ${position.y}px)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
            />

            {/* Mask Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {cropShape === 'circle' ? (
                <div 
                  className="w-[250px] h-[250px] rounded-full border-[2px] border-dashed border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.6)]" 
                />
              ) : (
                <div 
                  className="w-[320px] h-[128px] border-[2px] border-dashed border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.6)]" 
                />
              )}
            </div>

            {/* Drag guide helper icon */}
            <div className="absolute bottom-3 right-3 p-1.5 bg-slate-900/60 backdrop-blur-md rounded-lg text-white pointer-events-none opacity-60">
              <Move size={10} />
            </div>
          </div>
        </div>

        {/* Zoom Slider Controls */}
        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <ZoomOut size={14} className="text-slate-400" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(e) => {
                const newZoom = parseFloat(e.target.value);
                setZoom(newZoom);
                // Adjust constrained position on zoom change
                const currentW = imageSize.width * newZoom;
                const currentH = imageSize.height * newZoom;
                const limitX = Math.max(0, (currentW - cropWidth) / 2);
                const limitY = Math.max(0, (currentH - cropHeight) / 2);
                setPosition(prev => ({
                  x: Math.min(Math.max(prev.x, -limitX), limitX),
                  y: Math.min(Math.max(prev.y, -limitY), limitY)
                }));
              }}
              className="flex-1 accent-brand-500 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer outline-none"
            />
            <ZoomIn size={14} className="text-slate-400" />
            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 w-10 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-black text-[11px] uppercase tracking-wider rounded-2xl shadow-md active:scale-95 transition-all outline-none flex items-center justify-center gap-1.5"
            >
              <Check size={14} /> Apply Crop
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-450 font-black text-[11px] uppercase tracking-wider rounded-2xl active:scale-95 transition-all outline-none flex items-center justify-center gap-1.5"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
