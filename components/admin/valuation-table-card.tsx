'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ANCHOR_LABELS, CABIN_LABELS, formatReviewDate, formatSourceMonth } from '@/lib/valuation/presentation';
import type { ValuationAdminData } from '@/lib/valuation/admin';
import { ValuationRateForm } from './valuation-rate-form';

/**
 * Display manual valuation rates and the form for recording their next versions.
 * @returns Responsive administrator card with dated rates and overdue badges.
 */
export function ValuationTableCard() {
  const [data, setData] = useState<ValuationAdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/admin/valuation-table', { cache: 'no-store' });
    if (!response.ok) throw new Error('Die Bewertungstabelle konnte nicht geladen werden.');
    setData((await response.json()) as ValuationAdminData);
    setError(null);
  }, []);

  useEffect(() => {
    refresh().catch((error: unknown) => setError(error instanceof Error ? error.message : 'Laden fehlgeschlagen.'));
  }, [refresh]);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Bewertungssätze</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!data && !error && <Skeleton className="h-24 w-full" />}
        {data && (
          <>
            <p className="text-sm text-muted-foreground">
              Stand: {formatSourceMonth(data.tableAsOf)} · {data.rates.length} Sätze ·{' '}
              {data.rates.filter((rate) => rate.stale).length} überfällig
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  {['Programm', 'Anker', 'Klasse', 'ct/Punkt', 'Quelle', 'Stand', 'Fällig', 'Status'].map((heading) => (
                    <TableHead key={heading}>{heading}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rates.map((rate) => (
                  <TableRow key={`${rate.programId}:${rate.anchor}:${rate.cabin}`}>
                    <TableCell>{rate.programName}</TableCell>
                    <TableCell>{ANCHOR_LABELS[rate.anchor]}</TableCell>
                    <TableCell>{CABIN_LABELS[rate.cabin]}</TableCell>
                    <TableCell className="tabular-nums">
                      {rate.centsPerUnit.toLocaleString('de-DE', { maximumFractionDigits: 3 })}
                    </TableCell>
                    <TableCell>
                      {rate.sourceUrl && /^https?:\/\//i.test(rate.sourceUrl) ? (
                        <a
                          className="underline underline-offset-4"
                          href={rate.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {rate.source}
                        </a>
                      ) : (
                        rate.source
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatSourceMonth(rate.sourceAsOf)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatReviewDate(rate.reviewDue)}</TableCell>
                    <TableCell>{rate.stale && <Badge variant="destructive">überfällig</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ValuationRateForm programs={data.programs} onSaved={refresh} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
