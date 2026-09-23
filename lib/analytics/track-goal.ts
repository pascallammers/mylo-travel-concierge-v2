/**
 * DataFast goal tracking for client components.
 *
 * The DataFast script loads with `lazyOnload`, so goals fired during the first
 * render land in the queue that `DATAFAST_QUEUE_SNIPPET` installs in `<head>`;
 * the script drains it once loaded.
 */

type DealGoalParams = {
  destination: string;
  source: string;
  kind: string;
};

/** Every goal MYLO sends, with its custom parameters (max 10, values max 255 chars). */
export interface GoalParamsByName {
  deal_view: DealGoalParams;
  deal_expand: DealGoalParams;
  chat_start_from_deal: DealGoalParams;
  affiliate_click: DealGoalParams;
  model_selected: { model: string };
}

export type GoalName = keyof GoalParamsByName;

type DataFastFunction = (goal: string, params?: Record<string, string>) => void;

/** The part of `window` the helper touches. */
export interface DataFastHost {
  datafast?: DataFastFunction;
}

declare global {
  interface Window {
    datafast?: DataFastFunction;
  }
}

/** Inline script for `<head>`: queues `datafast()` calls until the real script has loaded. */
export const DATAFAST_QUEUE_SNIPPET =
  'window.datafast = window.datafast || function() { window.datafast.q = window.datafast.q || []; window.datafast.q.push(arguments); };';

/**
 * Sends a DataFast goal. No-op on the server or when neither the script nor the queue exists.
 *
 * @param goal - Goal name as shown in the DataFast dashboard.
 * @param params - Custom parameters for this goal.
 * @param host - Object holding `datafast`; defaults to `window` in the browser.
 * @returns Nothing.
 */
export function trackGoal<Name extends GoalName>(
  goal: Name,
  params: GoalParamsByName[Name],
  host: DataFastHost | undefined = typeof window === 'undefined' ? undefined : window,
): void {
  host?.datafast?.(goal, params);
}
