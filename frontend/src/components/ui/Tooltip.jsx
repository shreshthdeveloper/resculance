import React, { useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Tooltip = ({ anchorRef, label }) => {
  const [pos, setPos] = useState(null);
  const [visible, setVisible] = useState(false);
  const [placement, setPlacement] = useState('right');

  useLayoutEffect(() => {
    if (!anchorRef || !anchorRef.current) return;
    const el = anchorRef.current;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const spaceRight = window.innerWidth - rect.right;
      const spaceLeft = rect.left;
      // prefer right placement, but flip to left when not enough space
      const preferRight = spaceRight > 220 || spaceRight > spaceLeft;
      if (preferRight) {
        const left = rect.right + 10;
        const top = rect.top + rect.height / 2 - 8;
        setPlacement('right');
        setPos({ top, left });
      } else {
        // position anchored to left edge, we'll translateX(-100%) when rendering
        const left = rect.left - 10;
        const top = rect.top + rect.height / 2 - 8;
        setPlacement('left');
        setPos({ top, left });
      }
    };

    update();

    const onEnter = () => setVisible(true);
    const onLeave = () => setVisible(false);
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('focus', onEnter);
    el.addEventListener('blur', onLeave);
      let touchTimeout = null;
      const onTouch = (e) => {
        // toggle on touch; keep visible for a short duration
        e.preventDefault?.();
        setVisible((v) => !v);
        if (touchTimeout) clearTimeout(touchTimeout);
        touchTimeout = setTimeout(() => setVisible(false), 2500);
      };
      el.addEventListener('touchstart', onTouch, { passive: false });
    // update on scroll/resize to keep tooltip aligned
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('focus', onEnter);
      el.removeEventListener('blur', onLeave);
      el.removeEventListener('touchstart', onTouch);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchorRef]);

  if (!pos) return null;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: placement === 'left' ? 6 : -6, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: placement === 'left' ? 6 : -6, scale: 0.98 }}
          transition={{ duration: 0.12 }}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: placement === 'left' ? 'translateY(-50%) translateX(-100%)' : 'translateY(-50%) translateX(0)'
          }}
          className="z-50 pointer-events-none"
        >
          <div className="relative">
            <div className="bg-teal-500 text-white text-sm px-3 py-1.5 rounded-lg shadow-2xl whitespace-nowrap font-medium">
              {label}
            </div>
            {/* Arrow */}
            {placement === 'right' ? (
              <div style={{ position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%) rotate(45deg)' }}>
                <div className="w-3 h-3 bg-teal-500 shadow-lg" />
              </div>
            ) : (
              <div style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%) rotate(45deg)' }}>
                <div className="w-3 h-3 bg-teal-500 shadow-lg" />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Tooltip;
