'use client';

import { useEffect, useState, useCallback } from 'react';
import { StatsCard } from '@/components/admin/stats-card';
import { KPIRevenueChart } from '@/components/admin/kpi-revenue-chart';
import { KPIChurnChart } from '@/components/admin/kpi-churn-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  CreditCard,
  UserMinus,
  RefreshCw,
  Download,
  Clock,
  Repeat,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';

type DateRange = 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'all_time';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  this_month: 'Dieser Monat',
  last_month: 'Letzter Monat',
  this_year: 'Dieses Jahr',
  last_year: 'Letztes Jahr',
  all_time: 'Gesamt',
};

interface KPIData {
  dateRange: DateRange;
  revenue: {
    mrr: number;
    totalRevenue: number;
    previousPeriodRevenue: number;
    revenueGrowthPercent: number;
    arpu: number;
    ltv: number;
    currency: string;
  };
  subscriptions: {
    totalActiveSubscribers: number;
    totalCancelledSubscribers: number;
    newSubscribers: number;
    previousPeriodNewSubscribers: number;
    averageSubscriptionMonths: number;
  };
  churn: {
    churnRate: number;
    previousPeriodChurnRate: number;
    churned: number;
    previousPeriodChurned: number;
  };
  payments: {
    totalPayments: number;
    successfulRebills: number;
    failedPayments: number;
    refunds: number;
    refundAmount: number;
    paymentSuccessRate: number;
  };
  growth: {
    monthlyRevenue: Array<{ month: string; revenue: number; subscribers: number }>;
    monthlyChurn: Array<{ month: string; churnRate: number; churned: number }>;
  };
  importState: {
    lastImportAt: string | null;
    totalImported: number;
    status: string;
  };
}

interface ImportStatus {
  status: string;
  lastImportAt: string | null;
  totalImported: number;
  lastError: string | null;
}

export default function KPIDashboard() {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('this_month');

  const fetchKPIs = useCallback(async (range: DateRange) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/kpi?range=${range}`);
      if (!res.ok) throw new Error('Fehler beim Laden der KPIs');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchImportStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/kpi/import');
      if (res.ok) {
        const status = await res.json();
        setImportStatus(status);
        return status.status;
      }
    } catch {
      // Silently ignore polling errors
    }
    return null;
  }, []);

  useEffect(() => {
    fetchKPIs(dateRange);
    fetchImportStatus();
  }, [dateRange, fetchKPIs, fetchImportStatus]);

  // Poll import status while importing
  useEffect(() => {
    if (!importing) return;
    const interval = setInterval(async () => {
      const status = await fetchImportStatus();
      if (status === 'idle' || status === 'failed') {
        setImporting(false);
        await fetchKPIs(dateRange);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [importing, fetchImportStatus, fetchKPIs, dateRange]);

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    setImportStatus({ status: 'running', lastImportAt: null, totalImported: 0, lastError: 'Starte Import...' });

    try {
      const res = await fetch('/api/admin/kpi/import', { method: 'POST' });
      let result: Record<string, unknown> = {};
      const text = await res.text();
      try { result = JSON.parse(text); } catch { /* non-JSON response */ }

      if (!res.ok) {
        throw new Error((result.error as string) || 'Import konnte nicht gestartet werden.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import fehlgeschlagen';
      setImportStatus((prev) => prev ? { ...prev, status: 'failed', lastError: msg } : null);
      setImporting(false);
    }
  };

  const handleDateRangeChange = (value: string) => {
    setDateRange(value as DateRange);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const previousPeriodLabel = dateRange === 'this_month' ? 'Letzter Monat'
    : dateRange === 'last_month' ? 'Vormonat'
    : dateRange === 'this_year' ? 'Letztes Jahr'
    : dateRange === 'last_year' ? 'Vorjahr'
    : '';

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Fehler beim Laden der KPIs</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => fetchKPIs(dateRange)} variant="outline" className="mt-4">
            Erneut versuchen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative">
          <h1 className="font-['Playfair_Display'] text-4xl font-bold tracking-tight">
            Business KPIs
          </h1>
          <p className="mt-2 font-['Be_Vietnam_Pro'] text-base text-muted-foreground/80">
            Umsatz, Abonnenten und Churn im Ueberblick
          </p>
          <div className="mt-3 h-1 w-24 rounded-full bg-gradient-to-r from-primary via-accent to-transparent" />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => fetchKPIs(dateRange)} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Button onClick={handleImport} variant="outline" size="sm" disabled={importing}>
            <Download className={`h-4 w-4 mr-2 ${importing ? 'animate-spin' : ''}`} />
            {importing ? 'Importiert...' : 'Vollimport'}
          </Button>
        </div>
      </div>

      {/* Date Range Switcher */}
      <Tabs value={dateRange} onValueChange={handleDateRangeChange}>
        <TabsList>
          {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((key) => (
            <TabsTrigger key={key} value={key} disabled={loading}>
              {DATE_RANGE_LABELS[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Import status banner */}
      {(importStatus?.status === 'running' || importing) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Import laeuft...
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                {importStatus?.lastError || 'Verbinde mit ThriveCart API...'}
                {importStatus?.totalImported != null && importStatus.totalImported > 0 && (
                  <> — {importStatus.totalImported} neue Transaktionen</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
      {importStatus?.status === 'failed' && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Import fehlgeschlagen
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 truncate">
                {importStatus.lastError || 'Unbekannter Fehler'}
              </p>
            </div>
          </div>
        </div>
      )}
      {data && !importing && importStatus?.status !== 'running' && importStatus?.status !== 'failed' && (
        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>
            Letzter Import: {data.importState.lastImportAt
              ? formatDate(data.importState.lastImportAt)
              : 'Noch kein Import durchgefuehrt'}
            {data.importState.totalImported > 0 && (
              <> — {data.importState.totalImported} Transaktionen</>
            )}
          </span>
        </div>
      )}

      {/* Revenue KPIs */}
      <div>
        <h2 className="mb-4 font-['Playfair_Display'] text-2xl font-semibold tracking-tight">
          Umsatz
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                <CardContent><Skeleton className="h-8 w-16" /></CardContent>
              </Card>
            ))
          ) : data && (
            <>
              <StatsCard
                title="MRR"
                value={formatCurrency(data.revenue.mrr)}
                description="Monthly Recurring Revenue"
                icon={DollarSign}
                iconClassName="text-emerald-500"
                delay={0}
              />
              <StatsCard
                title="Umsatz"
                value={formatCurrency(data.revenue.totalRevenue)}
                description={previousPeriodLabel ? `${previousPeriodLabel}: ${formatCurrency(data.revenue.previousPeriodRevenue)}` : DATE_RANGE_LABELS[dateRange]}
                icon={BarChart3}
                iconClassName="text-blue-500"
                delay={100}
              />
              <StatsCard
                title="ARPU"
                value={formatCurrency(data.revenue.arpu)}
                description="Avg. Revenue Per User / Monat"
                icon={Users}
                delay={200}
              />
              <StatsCard
                title="LTV"
                value={formatCurrency(data.revenue.ltv)}
                description="Customer Lifetime Value"
                icon={TrendingUp}
                iconClassName="text-violet-500"
                delay={300}
              />
            </>
          )}
        </div>
      </div>

      {/* Subscription KPIs */}
      <div>
        <h2 className="mb-4 font-['Playfair_Display'] text-2xl font-semibold tracking-tight">
          Abonnenten
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                <CardContent><Skeleton className="h-8 w-16" /></CardContent>
              </Card>
            ))
          ) : data && (
            <>
              <StatsCard
                title="Aktive Abonnenten"
                value={data.subscriptions.totalActiveSubscribers}
                description="Aktuell aktive Abos"
                icon={Users}
                iconClassName="text-emerald-500"
                delay={0}
              />
              <StatsCard
                title="Neue Abonnenten"
                value={data.subscriptions.newSubscribers}
                description={previousPeriodLabel ? `${previousPeriodLabel}: ${data.subscriptions.previousPeriodNewSubscribers}` : DATE_RANGE_LABELS[dateRange]}
                icon={TrendingUp}
                iconClassName="text-blue-500"
                delay={100}
              />
              <StatsCard
                title="Gekuendigte Abos"
                value={data.churn.churned}
                description={previousPeriodLabel ? `${previousPeriodLabel}: ${data.churn.previousPeriodChurned}` : DATE_RANGE_LABELS[dateRange]}
                icon={UserMinus}
                iconClassName="text-orange-500"
                delay={200}
              />
              <StatsCard
                title="Ø Abo-Dauer"
                value={`${data.subscriptions.averageSubscriptionMonths} Monate`}
                description="Durchschnittliche Laufzeit"
                icon={Clock}
                delay={300}
              />
            </>
          )}
        </div>
      </div>

      {/* Churn & Payment KPIs */}
      <div>
        <h2 className="mb-4 font-['Playfair_Display'] text-2xl font-semibold tracking-tight">
          Churn & Zahlungen
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                <CardContent><Skeleton className="h-8 w-16" /></CardContent>
              </Card>
            ))
          ) : data && (
            <>
              <StatsCard
                title="Churn-Rate"
                value={`${data.churn.churnRate}%`}
                description={previousPeriodLabel ? `${previousPeriodLabel}: ${data.churn.previousPeriodChurnRate}%` : DATE_RANGE_LABELS[dateRange]}
                icon={TrendingDown}
                iconClassName={data.churn.churnRate > 5 ? 'text-red-500' : 'text-orange-500'}
                delay={0}
              />
              <StatsCard
                title="Zahlungserfolg"
                value={`${data.payments.paymentSuccessRate}%`}
                description={`${data.payments.successfulRebills} Rebills`}
                icon={CreditCard}
                iconClassName="text-emerald-500"
                delay={100}
              />
              <StatsCard
                title="Refunds"
                value={data.payments.refunds}
                description={data.payments.refundAmount > 0 ? `${formatCurrency(data.payments.refundAmount)} erstattet` : 'Keine Erstattungen'}
                icon={Repeat}
                iconClassName="text-amber-500"
                delay={200}
              />
              <StatsCard
                title="Fehlgeschlagen"
                value={data.payments.failedPayments}
                description="Zahlungen fehlgeschlagen"
                icon={AlertTriangle}
                iconClassName={data.payments.failedPayments > 0 ? 'text-red-500' : 'text-muted-foreground'}
                delay={300}
              />
            </>
          )}
        </div>
      </div>

      {/* Charts */}
      {!loading && data && (
        <div className="grid gap-4 md:grid-cols-2">
          <KPIRevenueChart data={data.growth.monthlyRevenue} />
          <KPIChurnChart data={data.growth.monthlyChurn} />
        </div>
      )}

      {/* Revenue comparison */}
      {!loading && data && dateRange !== 'all_time' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Umsatzentwicklung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{DATE_RANGE_LABELS[dateRange]}</span>
                  <span className="font-semibold">{formatCurrency(data.revenue.totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{previousPeriodLabel}</span>
                  <span className="font-medium">{formatCurrency(data.revenue.previousPeriodRevenue)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Wachstum</span>
                  <span className={`font-semibold ${data.revenue.revenueGrowthPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {data.revenue.revenueGrowthPercent >= 0 ? '+' : ''}{data.revenue.revenueGrowthPercent}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zahlungshistorie</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zahlungen</span>
                  <span className="font-semibold">{data.payments.totalPayments.toLocaleString('de-DE')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rebills</span>
                  <span className="font-medium">{data.payments.successfulRebills}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Kuendigungen</span>
                  <span className={`font-semibold ${data.churn.churned > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                    {data.churn.churned}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
