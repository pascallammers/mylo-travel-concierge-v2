import { sql } from 'drizzle-orm';
import { check, date, index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { CABINS } from './types';

export const valuationRates = pgTable(
  'valuation_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    programId: text('program_id').notNull(),
    anchor: text('anchor', { enum: ['travel', 'no_plan'] }).notNull(),
    cabin: text('cabin', { enum: CABINS }).notNull(),
    centsPerUnit: numeric('cents_per_unit', { precision: 6, scale: 3 }).notNull(),
    source: text('source').notNull(),
    sourceUrl: text('source_url'),
    sourceAsOf: date('source_as_of', { mode: 'date' }).notNull(),
    reviewDue: date('review_due', { mode: 'date' }).notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validTo: timestamp('valid_to', { withTimezone: true }),
    origin: text('origin', { enum: ['seed', 'admin'] }).notNull(),
    createdBy: text('created_by'),
    note: text('note'),
  },
  (table) => [
    check('valuation_rates_positive_value', sql`${table.centsPerUnit} > 0`),
    check('valuation_rates_anchor_valid', sql`${table.anchor} IN ('travel', 'no_plan')`),
    check(
      'valuation_rates_cabin_valid',
      sql`${table.cabin} IN ('all', 'economy', 'premium_economy', 'business', 'first')`,
    ),
    check('valuation_rates_origin_valid', sql`${table.origin} IN ('seed', 'admin')`),
    check('valuation_rates_no_plan_cabin', sql`${table.anchor} = 'travel' OR ${table.cabin} = 'all'`),
    uniqueIndex('valuation_rates_current_unique')
      .on(table.programId, table.anchor, table.cabin)
      .where(sql`${table.validTo} IS NULL`),
    index('valuation_rates_program_valid_to_idx').on(table.programId, table.validTo),
  ],
);
