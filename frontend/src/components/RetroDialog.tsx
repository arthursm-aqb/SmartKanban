import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface RetroDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  closeDisabled?: boolean;
  children: React.ReactNode;
}

/**
 * Native <dialog> modal styled as a Windows 95 window.
 * Follows modern-web-guidance `dialog` + `light-dismiss-a-dialog`:
 * - Opened via showModal() (no redundant role="dialog" or aria-modal)
 * - Uses closedby="any" + pointerdown/pointerup fallback when closedBy is unsupported
 * - Resets dialog.returnValue = '' on close
 */
export function RetroDialog({
  open,
  title,
  onClose,
  closeDisabled = false,
  children,
}: RetroDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };

    const handleCancel = (e: Event) => {
      if (closeDisabled) {
        e.preventDefault();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);

    // Fallback light-dismiss for browsers without native closedby support
    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!closeDisabled && pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    const supportsClosedBy = 'closedBy' in HTMLDialogElement.prototype;
    if (!supportsClosedBy) {
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
      if (!supportsClosedBy) {
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      }
    };
  }, [onClose, closeDisabled]);

  return (
    <dialog
      ref={dialogRef}
      className="win-dialog"
      aria-labelledby={titleId}
      {...({ closedby: closeDisabled ? 'none' : 'any' } as Record<string, string>)}
    >
      <div className="win-window">
        <div className="win-titlebar">
          <h2 id={titleId} style={{ margin: 0, fontSize: '0.95rem' }}>
            {title}
          </h2>
          <button
            type="button"
            className="win-btn win-btn-icon"
            aria-label={`Fechar ${title}`}
            disabled={closeDisabled}
            onClick={() => dialogRef.current?.close()}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="win-dialog-body">{children}</div>
      </div>
    </dialog>
  );
}
