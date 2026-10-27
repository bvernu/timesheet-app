import Modal from './Modal';
import Button from './Button';

// Replaces the browser's confirm() box.  tone="danger" makes the confirm button red.
const ConfirmDialog = ({
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}) => (
  <Modal
    title={title}
    onClose={busy ? undefined : onCancel}
    size="sm"
    footer={
      <>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
        <Button variant={tone === 'danger' ? 'danger-solid' : 'primary'} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="confirm-text">{children}</div>
  </Modal>
);

export default ConfirmDialog;
