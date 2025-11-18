'use client';

import { useEffect, useMemo, useState } from 'react';
import { StatsCard } from '@/components/admin/stats-card';
import { TokenUsageChart } from '@/components/admin/token-usage-chart';
import { ActivityChart } from '@/components/admin/activity-chart';
import { Activity, Clock, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TokenAnalytics {
  totalTokens: number;
  totalCost: number;
  topUsers: Array<{ email: string; tokens: number }>;
  dailyUsage: Array<{ date: string; tokens: number }>;
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

/**
 * Admin analytics page showing token and activity metrics over a selectable period.
 * @returns React component rendering analytics dashboards.
 */
export default function AnalyticsPage() {
  const [range, setRange] = useState('30');
  const [tokenAnalytics, setTokenAnalytics] = useState<TokenAnalytics | null>(null);
  const [activityAnalytics, setActivityAnalytics] = useState<ActivityAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        setError(null);

        const qs = `?days=${range}`;
        const [tokensRes, activityRes] = await Promise.all([
          fetch(`/api/admin/analytics/tokens${qs}`),
          fetch(`/api/admin/analytics/activity${qs}`),
        ]);

        if (!tokensRes.ok || !activityRes.ok) {
          throw new Error('Failed to load analytics data');
        }

        const [tokensData, activityData] = await Promise.all([
          tokensRes.json(),
          activityRes.json(),
        ]);

        setTokenAnalytics(tokensData);
        setActivityAnalytics(activityData);
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          [...Array(4)].map((_, i) => (
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
                value={`$${tokenAnalytics.totalCost.toFixed(2)}`}
                description="Basispreis $0.002 / 1K Tokens"
                icon={Clock}
                delay={100}
              />
              <StatsCard
                title="Aktive Nutzer"
                value={activityAnalytics.uniqueActiveUsers}
                description="Interagiert im Zeitraum"
                icon={Users}
                delay={200}
              />
              <StatsCard
                title="Ø Interaktionen"
                value={activityAnalytics.avgInteractionsPerUser}
                description="pro aktivem Nutzer"
                icon={Activity}
                delay={300}
              />
            </>
          )
        )}
      </div>

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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tägliche Token-Nutzung</CardTitle>
          </CardHeader>
          <CardContent>
            {tokenAnalytics.dailyUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Daten im gewählten Zeitraum.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {tokenAnalytics.dailyUsage.map((entry) => (
                  <div
                    key={entry.date}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span>{new Date(entry.date).toLocaleDateString()}</span>
                    <span className="font-medium">{entry.tokens.toLocaleString()} Tokens</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
