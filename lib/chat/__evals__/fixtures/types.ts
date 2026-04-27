// lib/chat/__evals__/fixtures/types.ts
export type EvalFixture = {
  id: string;
  source: 'real' | 'edge';
  description: string;
  userQuery: string;
  expectedTool: string | null;
  reason: string;
  now?: Date;
};
