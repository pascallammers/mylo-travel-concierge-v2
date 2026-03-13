'use client';

import { useEffect, useState, useCallback } from 'react';
import { StatsCard } from '@/components/admin/stats-card';
import { KPIRevenueChart } from '@/components/admin/kpi-revenue-chart';
import { KPIChurnChart } from '@/components/admin/kpi-churn-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

interface KPIData {
  revenue: {
    mrr: number;
    totalRevenueAllTime: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    revenueGrowthPercent: number;
    arpu: number;
    ltv: number;
    currency: string;
  };
  subscriptions: {
    totalActiveSubscribers: number;
    totalCancelledSubscribers: number;
    newSubscribersThisMonth: number;
    newSubscribersLastMonth: number;
    averageSubscriptionMonths: number;
  };
  churn: {
    churnRateThisMonth: number;
    churnRateLastMonth: number;
    churnedThisMonth: number;
    churnedLastMonth: number;
  };
  payments: {
    totalPaymentsAllTime: number;
    successfulRebillsThisMonth: number;
    failedPaymentsThisMonth: number;
    refundsThisMonth: number;
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

  const fetchKPIs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/kpi');
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
    fetchKPIs();
    fetchImportStatus();
  }, [fetchKPIs, fetchImportStatus]);

  // Poll import status while importing
  useEffect(() => {
    if (!importing) return;
    const interval = setInterval(async () => {
      const status = await fetchImportStatus();
      if (status === 'idle' || status === 'failed') {
        setImporting(false);
        await fetchKPIs();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [importing, fetchImportStatus, fetchKPIs]);

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    setImportStatus({ status: 'running', lastImportAt: null, totalImported: 0, lastError: 'Starte Import...' });

    try {
      const res = await fetch('/api/admin/kpi/import', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Import fehlgeschlagen');
      setImportStatus({
        status: 'idle',
        lastImportAt: new Date().toISOString(),
        totalImported: result.totalInserted,
        lastError: result.errors?.length > 0 ? result.errors.join('; ') : null,
      });
      await fetchKPIs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import fehlgeschlagen';
      setImportStatus((prev) => prev ? { ...prev, status: 'failed', lastError: msg } : null);
    } finally {
      setImporting(false);
    }
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

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Fehler beim Laden der KPIs</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={fetchKPIs} variant="outline" className="mt-4">
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
          <Button onClick={fetchKPIs} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Button onClick={handleImport} variant="outline" size="sm" disabled={importing}>
            <Download className={`h-4 w-4 mr-2 ${importing ? 'animate-spin' : ''}`} />
            {importing ? 'Importiert...' : 'Vollimport'}
          </Button>
        </div>
      </div>

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
                title="Umsatz gesamt"
                value={formatCurrency(data.revenue.totalRevenueAllTime)}
                description="All-time Revenue"
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
                value={data.subscriptions.newSubscribersThisMonth}
                description={`Letzter Monat: ${data.subscriptions.newSubscribersLastMonth}`}
                icon={TrendingUp}
                iconClassName="text-blue-500"
                delay={100}
              />
              <StatsCard
                title="Gekuendigte Abos"
                value={data.subscriptions.totalCancelledSubscribers}
                description="Gesamt gekuendigt"
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
                value={`${data.churn.churnRateThisMonth}%`}
                description={`Letzter Monat: ${data.churn.churnRateLastMonth}%`}
                icon={TrendingDown}
                iconClassName={data.churn.churnRateThisMonth > 5 ? 'text-red-500' : 'text-orange-500'}
                delay={0}
              />
              <StatsCard
                title="Zahlungserfolg"
                value={`${data.payments.paymentSuccessRate}%`}
                description={`${data.payments.successfulRebillsThisMonth} Rebills diesen Monat`}
                icon={CreditCard}
                iconClassName="text-emerald-500"
                delay={100}
              />
              <StatsCard
                title="Refunds"
                value={data.payments.refundsThisMonth}
                description={data.payments.refundAmount > 0 ? `${formatCurrency(data.payments.refundAmount)} erstattet` : 'Keine Erstattungen'}
                icon={Repeat}
                iconClassName="text-amber-500"
                delay={200}
              />
              <StatsCard
                title="Fehlgeschlagen"
                value={data.payments.failedPaymentsThisMonth}
                description="Zahlungen fehlgeschlagen"
                icon={AlertTriangle}
                iconClassName={data.payments.failedPaymentsThisMonth > 0 ? 'text-red-500' : 'text-muted-foreground'}
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
      {!loading && data && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Umsatzentwicklung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dieser Monat</span>
                  <span className="font-semibold">{formatCurrency(data.revenue.revenueThisMonth)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Letzter Monat</span>
                  <span className="font-medium">{formatCurrency(data.revenue.revenueLastMonth)}</span>
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
                  <span className="text-muted-foreground">Zahlungen gesamt</span>
                  <span className="font-semibold">{data.payments.totalPaymentsAllTime.toLocaleString('de-DE')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rebills diesen Monat</span>
                  <span className="font-medium">{data.payments.successfulRebillsThisMonth}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Kuendigungen diesen Monat</span>
                  <span className={`font-semibold ${data.churn.churnedThisMonth > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                    {data.churn.churnedThisMonth}
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
