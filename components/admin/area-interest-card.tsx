'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PREVIEW_AREA_SLUGS, type PreviewAreaSlug } from '@/lib/shell/preview-areas';

const AREA_LABELS: Record<PreviewAreaSlug, string> = { alerts: 'Alerts', cards: 'Kreditkarten' };
const ERROR_MESSAGE = 'Das Interesse an Vorschau-Bereichen konnte nicht geladen werden.';

/**
 * Show the number of interested users for each preview area.
 * @returns An interest table with loading and error states.
 */
export function AreaInterestCard() {
  const [counts, setCounts] = useState<Record<PreviewAreaSlug, number> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadCounts() {
      const response = await fetch('/api/admin/area-interest', { cache: 'no-store' });
      if (!response.ok) throw new Error(ERROR_MESSAGE);
      const data = await response.json() as { counts: Record<PreviewAreaSlug, number> };
      if (active) setCounts(data.counts);
    }
    loadCounts().catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Interesse an Vorschau-Bereichen</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="text-sm text-destructive">{ERROR_MESSAGE}</p>
        ) : counts ? (
          <Table aria-label="Interesse an Vorschau-Bereichen">
            <TableHeader>
              <TableRow>
                <TableHead>Bereich</TableHead>
                <TableHead className="text-right">Interessierte Nutzer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PREVIEW_AREA_SLUGS.map((area) => (
                <TableRow key={area}>
                  <TableCell className="font-medium">{AREA_LABELS[area]}</TableCell>
                  <TableCell className="text-right tabular-nums">{counts[area].toLocaleString('de-DE')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div role="status" aria-label="Interesse wird geladen" className="space-y-3">
            {PREVIEW_AREA_SLUGS.map((area) => <Skeleton key={area} className="h-9 w-full" />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
