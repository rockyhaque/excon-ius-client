import { Modal } from "@/components/ui/Modal";

export function ConfirmModal({
  open,
  title = "Confirm delete",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width={420}
      footer={
        <div className="foundations__modal-actions">
          <button className="foundations__btn foundations__btn--ghost" type="button" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className="foundations__btn foundations__btn--danger"
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      }
    >
      <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>{message}</p>
    </Modal>
  );
}
