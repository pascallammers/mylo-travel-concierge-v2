'use client';

import { useEffect, useMemo, useState } from 'react';
import { StatsCard } from '@/components/admin/stats-card';
import { TokenUsageChart } from '@/components/admin/token-usage-chart';
import { ActivityChart } from '@/components/admin/activity-chart';
import { FailoverCard, type FailoverAnalytics } from '@/components/admin/failover-card';
import { Activity, Clock, DollarSign, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface TokenAnalytics {
  totalTokens: number;
  totalCost: number;
  totalCostUsd: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  estimatedRevenueEur: number;
  estimatedProfitEur: number;
  trackedUsers: number;
  revenuePerUserEur: number;
  topUsers: Array<{ email: string; tokens: number; costUsd: number }>;
  users: Array<{
    userId: string;
    email: string;
    messageCount: number;
    inputTokens: number;
    cachedInputTokens: number;
    billableInputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
    revenueEur: number;
    estimatedProfitEur: number;
  }>;
  dailyUsage: Array<{ date: string; tokens: number; totalTokens: number; costUsd: number }>;
  pricing: {
    inputUsdPerMillion: number;
    cachedInputUsdPerMillion: number;
    outputUsdPerMillion: number;
    monthlyRevenuePerUserEur: number;
    usdToEurRate: number;
  };
}

interface ActivityAnalytics {
  totalInteractions: number;
  uniqueActiveUsers: number;
  avgInteractionsPerUser: number;
  activeUsersByDay: Array<{ date: string; count: number }>;
}

const RANGE_OPTIONS = [
  { label: '7 Tage', value: '7' },
  { label: '30 Tage', value: '30' },
  { label: '90 Tage', value: '90' },
];

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const eurFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

/**
 * Admin analytics page showing token and activity metrics over a selectable period.
 * @returns React component rendering analytics dashboards.
 */
export default function AnalyticsPage() {
  const [range, setRange] = useState('30');
  const [tokenAnalytics, setTokenAnalytics] = useState<TokenAnalytics | null>(null);
  const [activityAnalytics, setActivityAnalytics] = useState<ActivityAnalytics | null>(null);
  const [failoverAnalytics, setFailoverAnalytics] = useState<FailoverAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        setError(null);

        const qs = `?days=${range}`;
        // Failover endpoint is allowed to fail (e.g. before migration 0020 has
        // run on this environment) without taking down the rest of the
        // dashboard. tokens/activity remain hard requirements.
        const [tokensRes, activityRes, failoverRes] = await Promise.all([
          fetch(`/api/admin/analytics/tokens${qs}`),
          fetch(`/api/admin/analytics/activity${qs}`),
          fetch('/api/admin/analytics/failover').catch(() => null),
        ]);

        if (!tokensRes.ok || !activityRes.ok) {
          throw new Error('Failed to load analytics data');
        }

        const [tokensData, activityData] = await Promise.all([
          tokensRes.json(),
          activityRes.json(),
        ]);

        let failoverData: FailoverAnalytics | null = null;
        if (failoverRes && failoverRes.ok) {
          try {
            failoverData = await failoverRes.json();
          } catch {
            failoverData = null;
          }
        }

        setTokenAnalytics(tokensData);
        setActivityAnalytics(activityData);
        setFailoverAnalytics(failoverData);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [range]);

  const chartTopUsers = useMemo(() => tokenAnalytics?.topUsers ?? [], [tokenAnalytics]);
  const chartActiveUsers = useMemo(
    () => activityAnalytics?.activeUsersByDay ?? [],
    [activityAnalytics],
  );
  const recentDailyUsage = useMemo(
    () =>
      (tokenAnalytics?.dailyUsage ?? [])
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30),
    [tokenAnalytics],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative">
          <h1 className="font-['Playfair_Display'] text-4xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-2 font-['Be_Vietnam_Pro'] text-base text-muted-foreground/80">
            Interaktionen und Token-Verbrauch
          </p>
          <div className="mt-3 h-1 w-24 rounded-full bg-gradient-to-r from-accent via-primary to-transparent" />
        </div>
        <Select value={range} onValueChange={setRange} disabled={loading}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Zeitraum" />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle>Fehler beim Laden</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          tokenAnalytics &&
          activityAnalytics && (
            <>
              <StatsCard
                title="Gesamt-Tokens"
                value={tokenAnalytics.totalTokens.toLocaleString()}
                description={`Zeitraum: ${range} Tage`}
                icon={Activity}
                delay={0}
              />
              <StatsCard
                title="API-Kosten"
                value={usdFormatter.format(tokenAnalytics.totalCostUsd)}
                description="Grok 4.3 Input/Cached/Output"
                icon={Clock}
                delay={100}
              />
              <StatsCard
                title="Umsatz-Basis"
                value={eurFormatter.format(tokenAnalytics.estimatedRevenueEur)}
                description={`${eurFormatter.format(tokenAnalytics.revenuePerUserEur)} pro Nutzer im Zeitraum`}
                icon={DollarSign}
                delay={150}
              />
              <StatsCard
                title="Profit-Schätzung"
                value={eurFormatter.format(tokenAnalytics.estimatedProfitEur)}
                description={`${tokenAnalytics.trackedUsers} Nutzer mit Verbrauch`}
                icon={TrendingUp}
                delay={200}
              />
              <StatsCard
                title="Aktive Nutzer"
                value={activityAnalytics.uniqueActiveUsers}
                description="Interagiert im Zeitraum"
                icon={Users}
                delay={300}
              />
            </>
          )
        )}
      </div>

      <FailoverCard data={failoverAnalytics} loading={loading} />

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          [...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          tokenAnalytics &&
          activityAnalytics && (
            <>
              <TokenUsageChart data={chartTopUsers} title="Top Nutzer nach Tokens" />
              <ActivityChart data={chartActiveUsers} title="Aktive Nutzer (täglich)" />
            </>
          )
        )}
      </div>

      {/* Additional details */}
      {!loading && tokenAnalytics && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nutzerkosten im Zeitraum</CardTitle>
            </CardHeader>
            <CardContent>
              {tokenAnalytics.users.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Daten im gewählten Zeitraum.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nutzer</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Input</TableHead>
                      <TableHead className="text-right">Cached</TableHead>
                      <TableHead className="text-right">Output</TableHead>
                      <TableHead className="text-right">Kosten</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokenAnalytics.users.map((entry) => (
                      <TableRow key={entry.userId}>
                        <TableCell className="max-w-[260px] truncate font-medium">{entry.email}</TableCell>
                        <TableCell className="text-right">{entry.totalTokens.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{entry.inputTokens.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{entry.cachedInputTokens.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{entry.outputTokens.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{usdFormatter.format(entry.costUsd)}</TableCell>
                        <TableCell className="text-right">{eurFormatter.format(entry.estimatedProfitEur)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tägliche Token-Nutzung</CardTitle>
            </CardHeader>
            <CardContent>
              {recentDailyUsage.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Daten im gewählten Zeitraum.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {recentDailyUsage.map((entry) => (
                    <div key={entry.date} className="rounded-md border px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span>{new Date(entry.date).toLocaleDateString()}</span>
                        <span className="font-medium">{entry.totalTokens.toLocaleString()} Tokens</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{usdFormatter.format(entry.costUsd)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
