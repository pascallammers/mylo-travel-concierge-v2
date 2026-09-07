import type { ToolFailureReport } from './tool-failure-alert';

const CELL_STYLE = 'padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top;';
const HEADER_STYLE = `${CELL_STYLE}font-size:12px;color:#4b5563;`;

/**
 * Renders the German admin email for a daily tool-failure report.
 *
 * @param report - Full tool report including the tools that triggered the alert.
 * @returns Escaped HTML suitable for Resend delivery.
 */
export function renderToolFailureAlertHtml(report: ToolFailureReport): string {
  const alertRows = report.alerting
    .map((tool) => {
      const reasons =
        tool.topErrors.length > 0
          ? tool.topErrors
              .map((entry) => `${escapeHtml(entry.error)} (${entry.count}×)`)
              .join('<br>')
          : 'Kein Fehlergrund gespeichert';

      return `
        <tr>
          <td style="${CELL_STYLE}font-weight:600;">${escapeHtml(tool.toolName)}</td>
          <td style="${CELL_STYLE}">${tool.failed}/${tool.calls}</td>
          <td style="${CELL_STYLE}">${reasons}</td>
        </tr>`;
    })
    .join('');

  const allToolRows = report.tools
    .map(
      (tool) => `
        <tr>
          <td style="${CELL_STYLE}">${escapeHtml(tool.toolName)}</td>
          <td style="${CELL_STYLE}">${tool.calls}</td>
          <td style="${CELL_STYLE}">${tool.failed}</td>
          <td style="${CELL_STYLE}">${Math.round(tool.failureRate * 100)} %</td>
        </tr>`,
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="de">
      <body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
        <div style="max-width:680px;margin:0 auto;padding:24px;">
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
            <h1 style="margin:0 0 8px;font-size:24px;">⚠️ Werkzeug-Ausfall</h1>
            <p style="margin:0 0 20px;color:#4b5563;font-size:14px;">
              Zeitraum: ${escapeHtml(report.periodStart)} bis ${escapeHtml(report.periodEnd)}
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
              <thead>
                <tr>
                  <th style="${HEADER_STYLE}">Werkzeug</th>
                  <th style="${HEADER_STYLE}">Fehler in 24 h</th>
                  <th style="${HEADER_STYLE}">Häufigste Gründe</th>
                </tr>
              </thead>
              <tbody>${alertRows}</tbody>
            </table>
            <h2 style="margin:0 0 8px;font-size:16px;">Alle Werkzeuge</h2>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr>
                  <th style="${HEADER_STYLE}">Werkzeug</th>
                  <th style="${HEADER_STYLE}">Aufrufe</th>
                  <th style="${HEADER_STYLE}">Fehler</th>
                  <th style="${HEADER_STYLE}">Quote</th>
                </tr>
              </thead>
              <tbody>${allToolRows}</tbody>
            </table>
          </div>
        </div>
      </body>
    </html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
