
import React, { useState, useRef, useCallback } from 'react';

type Direction = 'horizontal' | 'vertical';

interface ResizablePanelProps {
  children: React.ReactNode[];
  direction: Direction;
  initialSize: number;
  minSize?: number;
  className?: string;
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  direction,
  initialSize,
  minSize = 50,
  className = '',
}) => {
  const [size, setSize] = useState(initialSize);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const startSize = size;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPos;
      let newSize = startSize + delta;

      if (wrapperRef.current) {
        const parentSize = direction === 'horizontal' ? wrapperRef.current.parentElement!.offsetWidth : wrapperRef.current.parentElement!.offsetHeight;
        if (newSize < minSize) newSize = minSize;
        if (newSize > parentSize - minSize) newSize = parentSize - minSize;
      }
      
      setSize(newSize);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [direction, minSize, size]);
  
  const isHorizontal = direction === 'horizontal';
  const firstPanelStyle = { [isHorizontal ? 'width' : 'height']: `${size}px` };
  const resizerClass = isHorizontal 
    ? 'w-1.5 cursor-col-resize' 
    : 'h-1.5 cursor-row-resize';

  return (
    <div ref={wrapperRef} className={`flex flex-grow h-full ${isHorizontal ? 'flex-row' : 'flex-col'} ${className}`}>
      <div style={firstPanelStyle} className="flex-shrink-0 overflow-hidden relative">
        {children[0]}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className={`flex-shrink-0 bg-white/5 hover:bg-purple-500/50 transition-colors z-10 ${resizerClass}`}
        aria-hidden="true"
      />
      <div className="flex-grow overflow-hidden relative">
        {children[1]}
      </div>
    </div>
  );
};

export default ResizablePanel;