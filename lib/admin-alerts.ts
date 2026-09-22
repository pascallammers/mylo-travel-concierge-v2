import { sendAdminMail } from '@/lib/email';
import { renderTransferCheckFailureEmail, renderTransferTableEmail } from '@/lib/transfer-table/email';
import { SOURCE_LABELS } from '@/lib/transfer-table/presentation';
import type { SourceProgramId, TransferCheck } from '@/lib/transfer-table/types';
import { renderValuationStaleEmail } from '@/lib/valuation/email';
import type { RateKey, ResolvedRate } from '@/lib/valuation/types';

/**
 * Send transfer-table changes or source failures to the administrator.
 * @param check - Persisted source check.
 * @returns Completion after the mail provider accepts the message.
 */
export async function sendTransferTableAdminAlert(check: TransferCheck): Promise<void> {
  await sendAdminMail('Transfertabelle: Quellenprüfung – MYLO', renderTransferTableEmail(check));
}

/**
 * Tell the administrator that a transfer-table check could not be persisted.
 * @param source - Source whose check failed.
 * @param message - Failure reason.
 * @returns Completion after the mail provider accepts the message.
 */
export async function sendTransferCheckFailureAlert(source: SourceProgramId, message: string): Promise<void> {
  await sendAdminMail(
    'Transfertabelle: Prüfung nicht durchführbar – MYLO',
    renderTransferCheckFailureEmail(SOURCE_LABELS[source], message),
  );
}

/**
 * Send one reminder listing every overdue valuation rate.
 * @param rates - Overdue current rates with their identities.
 * @returns Completion after the mail provider accepts the message.
 */
export async function sendValuationTableAdminAlert(rates: (ResolvedRate & RateKey)[]): Promise<void> {
  await sendAdminMail('Bewertungssätze: Überprüfung fällig – MYLO', renderValuationStaleEmail(rates));
}
