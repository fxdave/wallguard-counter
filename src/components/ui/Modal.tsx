import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional footer (typically action buttons). */
  footer?: ReactNode;
}

/** Centered glass dialog with backdrop. Closes on Escape and backdrop click. */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative flex w-full max-w-md flex-col rounded-3xl border border-white/10 bg-elevated shadow-2xl shadow-black/50"
            style={{ maxHeight: 'min(90dvh, 900px)' }}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex-none px-6 pt-6 pb-0">
              <h2 className="font-display text-xl font-bold tracking-tight">
                {title}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
            {footer && (
              <div className="flex-none border-t border-white/5 px-6 py-4 flex justify-end gap-2">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
