import { useCallback } from 'react';

import { useToast } from '../components/Toast';
import { useApp } from '../context/AppProvider';
import { restoreFromTrash } from '../services/local/library';

/**
 * Deletes documents straight away and offers Undo in a banner. Deleting is undoable
 * (documents go to Recently deleted), so no "Are you sure?" alert is needed.
 */
export function useDeleteWithUndo() {
  const { removeDocument, refreshDocuments, refreshFolders } = useApp();
  const toast = useToast();

  return useCallback(
    async (ids: string[]) => {
      const trashIds: string[] = [];
      for (const id of ids) {
        const trashId = await removeDocument(id);
        if (trashId) trashIds.push(trashId);
      }
      const n = ids.length;
      toast.show({
        message: n === 1 ? 'Moved to Recently deleted' : `${n} documents moved to Recently deleted`,
        action: trashIds.length
          ? {
              label: 'Undo',
              onPress: async () => {
                for (const trashId of trashIds) {
                  try {
                    await restoreFromTrash(trashId);
                  } catch {
                    // Already restored or erased: nothing to undo for this one.
                  }
                }
                await Promise.all([refreshDocuments(), refreshFolders()]);
                toast.show(n === 1 ? 'Document restored' : `${n} documents restored`);
              },
            }
          : undefined,
      });
    },
    [removeDocument, refreshDocuments, refreshFolders, toast],
  );
}
