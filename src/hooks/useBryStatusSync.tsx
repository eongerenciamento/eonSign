import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PendingDocument {
  id: string;
  status: string;
  bry_envelope_uuid?: string | null;
}

interface UseBryStatusSyncOptions {
  onStatusChange?: () => void;
  pollingInterval?: number; // in milliseconds
}

export const useBryStatusSync = (
  documents: PendingDocument[],
  options: UseBryStatusSyncOptions = {}
) => {
  const { onStatusChange, pollingInterval = 30000 } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  // Filter documents that need BRy sync (pending with bry_envelope_uuid)
  const pendingBryDocuments = documents.filter(
    (doc) => doc.status !== 'signed' && doc.bry_envelope_uuid
  );

  const syncDocuments = useCallback(async () => {
    if (isSyncingRef.current || pendingBryDocuments.length === 0) return;

    isSyncingRef.current = true;
    let hasChanges = false;

    try {
      console.log(`[BRy Sync] Syncing ${pendingBryDocuments.length} documents...`);

      const { data, error } = await supabase.functions.invoke('bry-sync-status', {
        body: { documentIds: pendingBryDocuments.map((d) => d.id) },
      });

      if (error) {
        console.error('[BRy Sync] Error:', error);
        return;
      }

      if (data?.results) {
        hasChanges = data.results.some(
          (r: { changed: boolean }) => r.changed
        );
        console.log('[BRy Sync] Results:', data.results);
      }

      if (hasChanges && onStatusChange) {
        console.log('[BRy Sync] Status changed, refreshing...');
        onStatusChange();
      }
    } catch (error) {
      console.error('[BRy Sync] Error:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [pendingBryDocuments, onStatusChange]);

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only set up polling if there are pending BRy documents
    if (pendingBryDocuments.length === 0) {
      console.log('[BRy Sync] No pending BRy documents, polling disabled');
      return;
    }

    console.log(
      `[BRy Sync] Starting polling for ${pendingBryDocuments.length} documents (every ${pollingInterval / 1000}s)`
    );

    // Initial sync after a short delay
    const initialTimeout = setTimeout(() => {
      syncDocuments();
    }, 2000);

    // Set up interval
    intervalRef.current = setInterval(syncDocuments, pollingInterval);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pendingBryDocuments.length, pollingInterval, syncDocuments]);

  return {
    pendingCount: pendingBryDocuments.length,
    isSyncing: isSyncingRef.current,
    syncNow: syncDocuments,
  };
};
