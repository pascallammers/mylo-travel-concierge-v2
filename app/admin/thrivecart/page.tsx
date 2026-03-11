'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, RefreshCw, Webhook, ArrowDownUp, Repeat } from 'lucide-react';

interface WebhookLog {
  id: string;
  eventType: string;
  eventId: string | null;
  orderId: string | null;
  customerEmail: string;
  processedAt: string;
  result: string;
  errorMessage: string | null;
}

interface SyncLog {
  id: string;
  startedAt: string;
  completedAt: string | null;
  totalChecked: number | null;
  totalCorrected: number | null;
  totalErrors: number | null;
  status: string;
}

export default function ThriveCartPage() {
  const [tab, setTab] = useState<'webhooks' | 'syncs'>('webhooks');
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: tab });
      if (searchText && tab === 'webhooks') params.set('search', searchText);

      const res = await fetch(`/api/admin/thrivecart?${params}`);
      const data = await res.json();

      if (tab === 'webhooks') {
        setWebhookLogs(data.logs || []);
      } else {
        setSyncLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [tab, searchText]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const resultBadge = (result: string) => {
    const styles =
      result === 'success'
        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        : result === 'error'
          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return <span className={`px-2 py-1 rounded text-xs ${styles}`}>{result}</span>;
  };

  const eventBadge = (eventType: string) => {
    const label = eventType.replace('order.', '').replace('_', ' ');
    const isRebill = eventType.includes('subscription_payment');
    const isPayment = eventType.includes('success') || isRebill;
    const isCancel = eventType.includes('cancelled') || eventType.includes('paused');
    const isFailed = eventType.includes('failed');
    const styles = isPayment
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      : isCancel
        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
        : isFailed
          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${styles}`}>
        {isRebill && <Repeat className="h-3 w-3" />}
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ThriveCart Aktivitaet</h1>
        <Button onClick={fetchLogs} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'webhooks' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('webhooks')}
        >
          <Webhook className="h-4 w-4 mr-2" />
          Webhook-Events
        </Button>
        <Button
          variant={tab === 'syncs' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('syncs')}
        >
          <ArrowDownUp className="h-4 w-4 mr-2" />
          Sync-Jobs
        </Button>
      </div>

      {/* Search (webhooks only) */}
      {tab === 'webhooks' && (
        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach E-Mail..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhook Logs Table */}
      {tab === 'webhooks' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {loading ? 'Laden...' : `${webhookLogs.length} Webhook-Events`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitpunkt</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Ergebnis</TableHead>
                  <TableHead>Fehler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhookLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(log.processedAt)}</TableCell>
                    <TableCell>{eventBadge(log.eventType)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{log.customerEmail}</TableCell>
                    <TableCell>{log.orderId || '-'}</TableCell>
                    <TableCell>{resultBadge(log.result)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                      {log.errorMessage || '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {webhookLogs.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Keine Webhook-Events gefunden
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Sync Logs Table */}
      {tab === 'syncs' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {loading ? 'Laden...' : `${syncLogs.length} Sync-Jobs`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gestartet</TableHead>
                  <TableHead>Abgeschlossen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Geprueft</TableHead>
                  <TableHead>Korrigiert</TableHead>
                  <TableHead>Fehler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(log.startedAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {log.completedAt ? formatDate(log.completedAt) : '-'}
                    </TableCell>
                    <TableCell>{resultBadge(log.status)}</TableCell>
                    <TableCell>{log.totalChecked ?? '-'}</TableCell>
                    <TableCell>
                      {log.totalCorrected && log.totalCorrected > 0 ? (
                        <span className="text-orange-600 font-medium">{log.totalCorrected}</span>
                      ) : (
                        log.totalCorrected ?? '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {log.totalErrors && log.totalErrors > 0 ? (
                        <span className="text-red-600 font-medium">{log.totalErrors}</span>
                      ) : (
                        log.totalErrors ?? '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {syncLogs.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Keine Sync-Jobs gefunden
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
