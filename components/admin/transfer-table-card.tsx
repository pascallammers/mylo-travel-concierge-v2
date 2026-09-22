'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { describeChange, OUTCOME_LABELS, SOURCE_LABELS } from '@/lib/transfer-table/presentation';
import type { Resolution, TransferCheck } from '@/lib/transfer-table/types';

type DisplayCheck = Omit<TransferCheck, 'checkedAt' | 'resolvedAt'> & { checkedAt: string; resolvedAt: string | null };
interface DashboardData {
  latest: DisplayCheck[];
  held: (DisplayCheck & { canApprove: boolean })[];
}

/**
 * Show source freshness and allow administrators to resolve the deviation lock.
 * @returns Responsive transfer-table dashboard card.
 */
export function TransferTableCard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/admin/transfer-table', { cache: 'no-store' });
    if (!response.ok) throw new Error('Die Transfertabelle konnte nicht geladen werden.');
    setData((await response.json()) as DashboardData);
  }, []);

  useEffect(() => {
    refresh().catch((error: unknown) => setError(error instanceof Error ? error.message : 'Laden fehlgeschlagen.'));
  }, [refresh]);

  async function resolve(checkId: string, resolution: Resolution) {
    setPending(checkId);
    setError(null);
    try {
      const response = await fetch('/api/admin/transfer-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkId, resolution }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Die Entscheidung konnte nicht gespeichert werden.');
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Transfertabelle DACH</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!data && !error && <Skeleton className="h-24 w-full" />}
        {data &&
          (['amex_dach', 'payback'] as const).map((source) => {
            const check = data.latest.find((item) => item.sourceProgramId === source);
            return (
              <div key={source} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{SOURCE_LABELS[source]}</span>
                {check ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <time dateTime={check.checkedAt}>
                      {new Date(check.checkedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}
                    </time>
                    <Badge variant={check.outcome === 'source_error' ? 'destructive' : 'secondary'}>
                      {check.resolution === 'approved'
                        ? 'Übernommen'
                        : check.resolution === 'rejected'
                          ? 'Verworfen'
                          : OUTCOME_LABELS[check.outcome]}
                    </Badge>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Noch nicht geprüft</span>
                )}
              </div>
            );
          })}
        {data?.held.map((check) => (
          <div key={check.id} className="space-y-3 rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">{SOURCE_LABELS[check.sourceProgramId]} · Freigabe nötig</p>
            <p className="text-muted-foreground">
              {new Date(check.checkedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}
            </p>
            <ul className="list-disc space-y-1 break-words pl-4">
              {check.changes.map((change, index) => (
                <li key={index}>{describeChange(change)}</li>
              ))}
            </ul>
            {!check.canApprove && (
              <p className="text-muted-foreground">
                Metadaten in dach.ts ergänzen. Danach kann die gesamte Prüfung übernommen werden.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={pending !== null || !check.canApprove}
                onClick={() => resolve(check.id, 'approved')}
              >
                Übernehmen
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending !== null}
                onClick={() => resolve(check.id, 'rejected')}
              >
                Verwerfen
              </Button>
            </div>
          </div>
        ))}
        {data && data.held.length === 0 && <p className="text-sm text-muted-foreground">Keine offenen Freigaben.</p>}
      </CardContent>
    </Card>
  );
}
