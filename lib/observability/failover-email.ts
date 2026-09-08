import type { FailoverAlertReport } from './failover-alert';

const CELL_STYLE = 'padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top;';
const HEADER_STYLE = `${CELL_STYLE}font-size:12px;color:#4b5563;`;

/**
 * Renders the German admin email for an hourly failover report.
 *
 * @param report - Failover report for the preceding hour.
 * @returns Escaped HTML suitable for Resend delivery.
 */
export function renderFailoverAlertHtml(report: FailoverAlertReport): string {
  const providerRows = Object.entries(report.providerBreakdown)
    .sort(([providerA, countA], [providerB, countB]) => countB - countA || providerA.localeCompare(providerB))
    .map(
      ([provider, count]) => `
        <tr>
          <td style="${CELL_STYLE}">${escapeHtml(provider)}</td>
          <td style="${CELL_STYLE}">${count}</td>
        </tr>`,
    )
    .join('');
  const attemptDepthRows = Object.entries(report.attemptDepthHistogram)
    .sort(([depthA], [depthB]) => Number(depthA) - Number(depthB))
    .map(
      ([depth, count]) => `
        <tr>
          <td style="${CELL_STYLE}">${depth}</td>
          <td style="${CELL_STYLE}">${count}</td>
        </tr>`,
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="de">
      <body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
        <div style="max-width:680px;margin:0 auto;padding:24px;">
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
            <h1 style="margin:0 0 8px;font-size:24px;">⚠️ AI-Gateway-Failover</h1>
            <p style="margin:0 0 8px;color:#111827;font-size:14px;">
              Zwischen ${escapeHtml(report.periodStart)} und ${escapeHtml(report.periodEnd)} gingen ${formatPercentage(report.failoverRate)} von ${report.totalRequests} Anfragen in den Failover (Schwelle ${formatPercentage(report.threshold)}).
            </p>
            <p style="margin:0 0 20px;color:#4b5563;font-size:14px;">
              Recovery: ${report.recoveryCount} (${formatPercentage(report.recoveryRate)})
            </p>
            <h2 style="margin:0 0 8px;font-size:16px;">Endgültiger Provider</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
              <thead>
                <tr>
                  <th style="${HEADER_STYLE}">Provider</th>
                  <th style="${HEADER_STYLE}">Anzahl</th>
                </tr>
              </thead>
              <tbody>${providerRows}</tbody>
            </table>
            <h2 style="margin:0 0 8px;font-size:16px;">Versuchstiefe</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr>
                  <th style="${HEADER_STYLE}">Versuche</th>
                  <th style="${HEADER_STYLE}">Anzahl</th>
                </tr>
              </thead>
              <tbody>${attemptDepthRows}</tbody>
            </table>
          </div>
        </div>
      </body>
    </html>`;
}

/**
 * Formats a rate as a German percentage with one decimal, e.g. `12,5 %`.
 *
 * @param rate - Ratio between 0 and 1.
 * @returns Percentage string with a comma decimal separator.
 */
export function formatPercentage(rate: number): string {
  return `${(rate * 100).toFixed(1).replace('.', ',')} %`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
