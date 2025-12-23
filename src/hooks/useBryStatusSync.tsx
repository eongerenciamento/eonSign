import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Polling adaptativo: rápido inicialmente, depois mais lento
const FAST_INTERVAL = 10000; // 10 segundos nas primeiras tentativas
const NORMAL_INTERVAL = 20000; // 20 segundos depois
const FAST_ATTEMPTS = 6; // 6 tentativas rápidas (~1 minuto)

interface PendingDocument {
  id: string;
  status: string;
  bry_envelope_uuid?: string | null;
}

interface UseBryStatusSyncOptions {
  onStatusChange?: () => void;
}

export const useBryStatusSync = (
  documents: PendingDocument[],
  options: UseBryStatusSyncOptions = {}
) => {
  const { onStatusChange } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);
  const syncCountRef = useRef(0);

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

  // Função para agendar próximo polling com intervalo adaptativo
  const scheduleNextSync = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
    }
    
    // Determinar intervalo baseado no número de tentativas
    const currentInterval = syncCountRef.current < FAST_ATTEMPTS 
      ? FAST_INTERVAL 
      : NORMAL_INTERVAL;
    
    console.log(`[BRy Sync] Próximo sync em ${currentInterval / 1000}s (tentativa ${syncCountRef.current + 1})`);
    
    intervalRef.current = setTimeout(async () => {
      await syncDocuments();
      syncCountRef.current++;
      
      // Continuar agendando se ainda há documentos pendentes
      if (pendingBryDocuments.length > 0) {
        scheduleNextSync();
      }
    }, currentInterval);
  }, [syncDocuments, pendingBryDocuments.length]);

  useEffect(() => {
    // Clear existing interval/timeout
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }

    // Reset contador quando documentos pendentes mudam
    syncCountRef.current = 0;

    // Only set up polling if there are pending BRy documents
    if (pendingBryDocuments.length === 0) {
      console.log('[BRy Sync] No pending BRy documents, polling disabled');
      return;
    }

    console.log(
      `[BRy Sync] Starting adaptive polling for ${pendingBryDocuments.length} documents (${FAST_INTERVAL/1000}s x ${FAST_ATTEMPTS}, then ${NORMAL_INTERVAL/1000}s)`
    );

    // Initial sync after a short delay (1 second)
    const initialTimeout = setTimeout(() => {
      syncDocuments().then(() => {
        syncCountRef.current++;
        scheduleNextSync();
      });
    }, 1000);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pendingBryDocuments.length, syncDocuments, scheduleNextSync]);

  return {
    pendingCount: pendingBryDocuments.length,
    isSyncing: isSyncingRef.current,
    syncNow: syncDocuments,
  };
};
