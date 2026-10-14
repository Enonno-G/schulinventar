import { useEffect, useRef } from 'react';

// Bestätigung für Löschen und andere nicht umkehrbare Aktionen (Pflichtenheft Kap. 5)
export default function ConfirmDialog({ open, title, confirmLabel = 'Löschen', onConfirm, onCancel, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(event) => {
        event.preventDefault(); // Escape-Taste
        onCancel();
      }}
    >
      <h2>{title}</h2>
      {children}
      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          Abbrechen
        </button>
        <button type="button" className="danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
