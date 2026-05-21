import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const InfoTip: React.FC<{ text: string; align?: 'center' | 'left' | 'right' }> = ({ text, align = 'center' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-[18px] h-[18px] rounded-full border border-slate-300 dark:border-slate-600
          text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400
          hover:border-violet-400 dark:hover:border-violet-500
          flex items-center justify-center text-[10px] font-bold leading-none
          transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        aria-label="Help info"
      >
        ?
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 top-full mt-1.5 w-64 px-3 py-2.5
              bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
              rounded-lg shadow-lg text-xs text-slate-600 dark:text-slate-300 leading-relaxed
              ${align === 'left' ? 'right-0' : align === 'right' ? 'left-0' : 'left-1/2 -translate-x-1/2'}`}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
