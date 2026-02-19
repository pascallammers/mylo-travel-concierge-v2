'use client';

import { AlertTriangle, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AdminAccessAuditIssue, AdminAccessAuditSummary, AccessAuditReason } from '@/hooks/use-admin-access-audit';

interface AccessAuditCardProps {
  summary: AdminAccessAuditSummary | undefined;
  issues: AdminAccessAuditIssue[];
  isLoading: boolean;
  isFetching: boolean;
  isRevoking: boolean;
  onRefresh: () => void;
  onRevokeSessions: () => Promise<void>;
}

const REASON_LABELS: Record<AccessAuditReason, string> = {
  account_inactive: 'Account gesperrt/inaktiv',
  no_subscription: 'Kein Abo',
  subscription_expired: 'Abo abgelaufen',
  subscription_status_blocked: 'Abo-Status blockiert',
};

/**
 * Formats a date string for German locale output.
 * @param dateString - ISO date string.
 * @returns Human readable date or dash.
 */
function formatDateTime(dateString: string | null): string {
  if (!dateString) {
    return '-';
  }

  return new Date(dateString).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AccessAuditCard({
  summary,
  issues,
  isLoading,
  isFetching,
  isRevoking,
  onRefresh,
  onRevokeSessions,
}: AccessAuditCardProps) {
  return (
    <Card className="border-amber-200/70 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/10">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Access Audit
            </CardTitle>
            <CardDescription>
              Findet gesperrte/abgelaufene Nutzer, die noch aktive Sessions haben.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading || isFetching || isRevoking}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Aktualisieren
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void onRevokeSessions()}
              disabled={isLoading || isRevoking || issues.length === 0}
            >
              {isRevoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Sessions bereinigen
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Geprüft: {summary?.checkedUsers ?? '-'}</Badge>
          <Badge variant="outline">Geblockt: {summary?.blockedUsers ?? '-'}</Badge>
          <Badge variant={issues.length > 0 ? 'destructive' : 'green'}>
            Mit offenen Sessions: {summary?.blockedWithLiveSessions ?? 0}
          </Badge>
          <Badge variant={issues.length > 0 ? 'destructive' : 'secondary'}>
            Offene Sessions: {summary?.liveSessionsOnBlockedUsers ?? 0}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Audit wird geladen...
          </div>
        ) : issues.length === 0 ? (
          <div className="text-sm text-green-700 dark:text-green-300">
            Keine offenen Sessions bei gesperrten/abgelaufenen Nutzern gefunden.
          </div>
        ) : (
          <div className="max-h-72 overflow-auto rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nutzer</TableHead>
                  <TableHead>Grund</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Session gültig bis</TableHead>
                  <TableHead>Abo gültig bis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.userId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{issue.name}</span>
                        <span className="text-xs text-muted-foreground">{issue.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">{REASON_LABELS[issue.reason]}</Badge>
                    </TableCell>
                    <TableCell>{issue.liveSessionCount}</TableCell>
                    <TableCell>{formatDateTime(issue.latestSessionExpiry)}</TableCell>
                    <TableCell>{formatDateTime(issue.subscriptionValidUntil)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
