'use client';

import { useEffect, useState } from 'react';
import { StatsCard } from '@/components/admin/stats-card';
import { TokenUsageChart } from '@/components/admin/token-usage-chart';
import { ActivityChart } from '@/components/admin/activity-chart';
import { FileText, Image, HardDrive, Activity, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalDocuments: number;
  totalMedia: number;
  storageUsed: number;
  systemStatus: string;
}

interface TokenAnalytics {
  totalTokens: number;
  totalCost: number;
  topUsers: Array<{ email: string; tokens: number }>;
}

interface ActivityAnalytics {
  totalInteractions: number;
  uniqueActiveUsers: number;
  avgInteractionsPerUser: number;
  activeUsersByDay: Array<{ date: string; count: number }>;
  mostActiveUser: { email: string; interactions: number } | null;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tokenAnalytics, setTokenAnalytics] = useState<TokenAnalytics | null>(null);
  const [activityAnalytics, setActivityAnalytics] = useState<ActivityAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [statsRes, tokensRes, activityRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/admin/analytics/tokens?days=30'),
          fetch('/api/admin/analytics/activity?days=30'),
        ]);

        if (!statsRes.ok || !tokensRes.ok || !activityRes.ok) {
          throw new Error('Failed to fetch admin data');
        }

        const [statsData, tokensData, activityData] = await Promise.all([
          statsRes.json(),
          tokensRes.json(),
          activityRes.json(),
        ]);

        setStats(statsData);
        setTokenAnalytics(tokensData);
        setActivityAnalytics(activityData);
      } catch (err) {
        console.error('Error fetching admin data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Error Loading Dashboard</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">System overview and statistics</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {loading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : stats ? (
          <>
            <StatsCard
              title="Documents"
              value={stats.totalDocuments}
              description="Testdokumente"
              icon={FileText}
            />
            <StatsCard
              title="Media"
              value={stats.totalMedia}
              description="Audio/Video Dateien"
              icon={Image}
            />
            <StatsCard
              title="Storage"
              value={`${stats.storageUsed} MB`}
              description="Gesamtspeicher"
              icon={HardDrive}
            />
            <StatsCard
              title="Status"
              value={stats.systemStatus === 'active' ? 'Active' : 'Maintenance'}
              description="System läuft"
              icon={Activity}
              iconClassName="text-green-500"
            />
            <StatsCard
              title="Users"
              value={stats.totalUsers}
              description="Registrierte User"
              icon={Users}
            />
          </>
        ) : null}
      </div>

      {/* Token Usage Section */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Token-Nutzung</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-24" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            stats &&
            tokenAnalytics &&
            activityAnalytics && (
              <>
                <StatsCard
                  title="Total Users"
                  value={stats.totalUsers}
                  description={`davon ${stats.activeUsers} aktiv in 30 Tagen`}
                  icon={Users}
                />
                <StatsCard
                  title="Token Usage (30 Days)"
                  value={tokenAnalytics.totalTokens.toLocaleString()}
                  description="Gesamte Tokens aller aktiven Nutzer"
                  icon={Activity}
                />
                <StatsCard
                  title="Costs (30 Days)"
                  value={`$${tokenAnalytics.totalCost.toFixed(2)}`}
                  description="Aggregierte API-Kosten"
                  icon={HardDrive}
                />
                <StatsCard
                  title="Ø Interactions"
                  value={activityAnalytics.avgInteractionsPerUser}
                  description="pro aktivem Nutzer / 30 Tage"
                  icon={Activity}
                />
              </>
            )
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <>
            {[...Array(2)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[300px] w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          tokenAnalytics &&
          activityAnalytics && (
            <>
              <TokenUsageChart data={tokenAnalytics.topUsers} />
              <ActivityChart data={activityAnalytics.activeUsersByDay} />
            </>
          )
        )}
      </div>

      {/* Activity Details */}
      {!loading && activityAnalytics && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Highest Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {activityAnalytics.mostActiveUser ? (
                  <>
                    <p className="font-medium">{activityAnalytics.mostActiveUser.email}</p>
                    <p className="text-muted-foreground">
                      {activityAnalytics.mostActiveUser.interactions} interactions in 30 days
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No active users</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Limit-Auslastung</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Kein Nutzer überschreitet 60% der Limits
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
