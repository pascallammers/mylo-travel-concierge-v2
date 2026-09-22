/**
 * Authorize the monthly review cron before accessing persistence or mail.
 * @param request - Incoming request carrying CRON_SECRET.
 * @param secret - Configured cron secret.
 * @param run - Injected deadline checker.
 * @returns German authorization/failure response or review summary.
 */
export async function handleValuationCron(
  request: Request,
  secret: string | undefined,
  run: () => Promise<{ stale: number; tableAsOf: string }>,
): Promise<Response> {
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Nicht autorisiert.' }, { status: 401 });
  }
  try {
    return Response.json(await run());
  } catch {
    return Response.json(
      { error: 'Die Bewertungstabelle konnte nicht geprüft oder die Benachrichtigung nicht versendet werden.' },
      { status: 500 },
    );
  }
}
