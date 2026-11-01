import { Trash2, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';

interface Props {
  open: boolean;
  count: number;
  /** Nom de la galerie quand il n'y en a qu'une (affiché dans le message). */
  label?: string;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({
  open,
  count,
  label,
  loading = false,
  error,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal open={open} onClose={loading ? () => {} : onCancel} closeOnBackdrop={!loading}>
      <div className="p-7">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-900/40 text-red-300">
          <AlertTriangle size={20} />
        </div>
        <h2 className="mt-4 font-display text-2xl font-medium text-cream">
          Supprimer {count > 1 ? `${count} galeries` : 'cette galerie'} ?
        </h2>
        <p className="mt-2 text-sm text-muted">
          {count > 1 ? (
            <>Les {count} galeries sélectionnées seront supprimées définitivement</>
          ) : (
            <>
              {label ? <span className="text-cream">« {label} »</span> : 'Cette galerie'} sera supprimée
              définitivement
            </>
          )}
          , ainsi que toutes les photos qu'elles contiennent (aperçus et HD) dans le stockage.{' '}
          <strong className="text-red-300">Cette action est irréversible.</strong>
        </p>
        {error && (
          <p className="mt-3 rounded-lg border border-red-800/50 bg-red-900/30 p-3 text-xs text-red-300">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            <Trash2 size={15} /> Supprimer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
