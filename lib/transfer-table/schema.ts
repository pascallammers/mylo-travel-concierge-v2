import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { TransferChange } from './types';

export const transferCheckOutcome = pgEnum('transfer_check_outcome', ['unchanged', 'applied', 'held', 'source_error']);

export const transferTableChecks = pgTable(
  'transfer_table_checks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceProgramId: text('source_program_id', { enum: ['amex_dach', 'payback'] }).notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull(),
    outcome: transferCheckOutcome('outcome').notNull(),
    changes: jsonb('changes').$type<TransferChange[]>().notNull(),
    error: text('error'),
    resolution: text('resolution', { enum: ['approved', 'rejected'] }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by'),
  },
  (table) => [
    index('transfer_checks_source_date_idx').on(table.sourceProgramId, table.checkedAt),
    check('transfer_checks_source_valid', sql`${table.sourceProgramId} IN ('amex_dach', 'payback')`),
    check(
      'transfer_checks_resolution_valid',
      sql`${table.resolution} IS NULL OR (${table.outcome} = 'held' AND ${table.resolution} IN ('approved', 'rejected'))`,
    ),
  ],
);

export const transferRates = pgTable(
  'transfer_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceProgramId: text('source_program_id', { enum: ['amex_dach', 'payback'] }).notNull(),
    partnerKey: text('partner_key').notNull(),
    sourcePoints: integer('source_points').notNull(),
    partnerUnits: integer('partner_units').notNull(),
    minTransfer: integer('min_transfer').notNull(),
    transferIncrement: integer('transfer_increment').notNull(),
    transferDurationDe: text('transfer_duration_de').notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validTo: timestamp('valid_to', { withTimezone: true }),
    origin: text('origin', { enum: ['seed', 'check'] }).notNull(),
    checkId: uuid('check_id').references(() => transferTableChecks.id),
  },
  (table) => [
    uniqueIndex('transfer_rates_current_unique')
      .on(table.sourceProgramId, table.partnerKey)
      .where(sql`${table.validTo} IS NULL`),
    check(
      'transfer_rates_positive_values',
      sql`${table.sourcePoints} > 0 AND ${table.partnerUnits} > 0 AND ${table.minTransfer} > 0 AND ${table.transferIncrement} > 0`,
    ),
    check('transfer_rates_source_valid', sql`${table.sourceProgramId} IN ('amex_dach', 'payback')`),
    check('transfer_rates_origin_valid', sql`${table.origin} IN ('seed', 'check')`),
  ],
);
