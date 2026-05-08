'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, GitBranch, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface FailoverAnalytics {
  failoverRate: number;
  totalRequests: number;
  providerBreakdown: Record<string, number>;
  attemptDepthHistogram: Record<number, number>;
  costEstimate: {
    estimatedUsd: number;
    eventCount: number;
  };
  spendWarningThresholdUsd: number;
  autoTopUpUrl: string;
}

interface FailoverCardProps {
  data: FailoverAnalytics | null;
  loading: boolean;
}

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

/**
 * Renders AI Gateway failover health, provider distribution, and spend guidance.
 *
 * @param props - Failover analytics data and loading state.
 * @returns Dashboard card for failover observability.
 */
export function FailoverCard({ data, loading }: FailoverCardProps) {
  const [dismissedUntil, setDismissedUntil] = useState<number>(0);

  useEffect(() => {
    const stored = window.localStorage.getItem('mylo.failoverAutoTopUpDismissedUntil');
    setDismissedUntil(stored ? Number.parseInt(stored, 10) : 0);
  }, []);

  const ratePercent = ((data?.failoverRate ?? 0) * 100).toFixed(1);
  const severity = getRateSeverity(data?.failoverRate ?? 0);
  const providerRows = useMemo(
    () => Object.entries(data?.providerBreakdown ?? {}).sort((a, b) => b[1] - a[1]),
    [data],
  );
  const depthRows = useMemo(
    () =>
      Object.entries(data?.attemptDepthHistogram ?? {})
        .map(([depth, count]) => ({ depth: Number(depth), count }))
        .sort((a, b) => a.depth - b.depth),
    [data],
  );
  const maxDepthCount = Math.max(...depthRows.map((row) => row.count), 1);
  const spendExceeded = (data?.costEstimate.estimatedUsd ?? 0) >= (data?.spendWarningThresholdUsd ?? 5);
  const showReminder = Boolean(data) && (spendExceeded || dismissedUntil < Date.now());

  function dismissReminder() {
    const nextDismissedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(
      'mylo.failoverAutoTopUpDismissedUntil',
      String(nextDismissedUntil),
    );
    setDismissedUntil(nextDismissedUntil);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4" />
          AI Gateway Failover
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="space-y-3">
            <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
            <div className="h-20 animate-pulse rounded-md bg-muted" />
          </div>
        ) : data ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className={`text-3xl font-semibold ${severity.textClass}`}>
                  {ratePercent}%
                </div>
                <p className="text-sm text-muted-foreground">
                  Failover-Rate, letzte 24h · {data.totalRequests.toLocaleString()} Requests
                </p>
              </div>
              <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${severity.badgeClass}`}>
                {severity.label}
              </span>
            </div>

            <div className={`rounded-md border px-3 py-3 ${spendExceeded ? 'border-amber-300 bg-amber-50 text-amber-950' : 'bg-muted/40'}`}>
              <p className="text-sm font-medium">
                Geschätzter Fallback-Spend (24h):{' '}
                {usdFormatter.format(data.costEstimate.estimatedUsd)}, {data.costEstimate.eventCount}{' '}
                Failover-Events
              </p>
            </div>

            {showReminder && (
              <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                  <span>Auto-Top-Up im Vercel-Dashboard konfigurieren.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={data.autoTopUpUrl} target="_blank" rel="noreferrer">
                      Öffnen <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </a>
                  </Button>
                  {!spendExceeded && (
                    <Button size="icon" variant="ghost" onClick={dismissReminder} aria-label="Reminder ausblenden">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Provider-Breakdown</p>
                {providerRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Gateway-Events im Zeitraum.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {providerRows.map(([provider, count]) => (
                        <TableRow key={provider}>
                          <TableCell className="font-medium">{provider}</TableCell>
                          <TableCell className="text-right">{count.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Attempt-Depth</p>
                <div className="space-y-2">
                  {depthRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Attempt-Daten im Zeitraum.</p>
                  ) : (
                    depthRows.map((row) => (
                      <div key={row.depth} className="grid grid-cols-[54px_minmax(0,1fr)_48px] items-center gap-2 text-sm">
                        <span>{row.depth} Step</span>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${Math.max((row.count / maxDepthCount) * 100, 8)}%` }}
                          />
                        </div>
                        <span className="text-right tabular-nums">{row.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Keine Failover-Daten geladen.</p>
        )}
      </CardContent>
    </Card>
  );
}

function getRateSeverity(rate: number) {
  if (rate >= 0.05) {
    return {
      label: 'Rot',
      textClass: 'text-destructive',
      badgeClass: 'bg-destructive/10 text-destructive',
    };
  }

  if (rate >= 0.01) {
    return {
      label: 'Gelb',
      textClass: 'text-amber-600',
      badgeClass: 'bg-amber-100 text-amber-800',
    };
  }

  return {
    label: 'Grün',
    textClass: 'text-emerald-600',
    badgeClass: 'bg-emerald-100 text-emerald-800',
  };
}
