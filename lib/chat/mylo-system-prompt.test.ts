import assert from 'node:assert';
import { describe, it } from 'node:test';

import { buildMyloWebSystemPrompt } from './mylo-system-prompt';

const FIXED_DATE = new Date('2026-04-27T10:00:00.000Z');

describe('buildMyloWebSystemPrompt', () => {
  describe('IDENTITY_AND_CRITICAL section', () => {
    it('declares MYLO as an AI web search engine', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /AI web search engine called MYLO/);
    });

    it('includes the formatted current date', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      const expected = FIXED_DATE.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        weekday: 'short',
      });
      assert.ok(prompt.includes(`Today's Date: ${expected}`));
    });

    it('includes the CRITICAL INSTRUCTION header', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /### CRITICAL INSTRUCTION:/);
    });
  });

  describe('KB_FIRST_AND_ROUTING section', () => {
    it('mandates knowledge_base before web_search', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /MANDATORY KNOWLEDGE BASE FIRST RULE/);
      assert.match(prompt, /ALWAYS call `knowledge_base` FIRST/);
    });

    it('lists the KB fallback signals', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /__KB_NOT_FOUND__/);
      assert.match(prompt, /__KB_LOW_CONFIDENCE__/);
      assert.match(prompt, /__KB_ERROR__/);
    });

    it('forbids reversing knowledge_base and web_search order', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /Never reverse the order/);
    });
  });

  describe('TOOL_SPECIFIC_GUIDELINES section', () => {
    it('marks search_flights as PRIORITY 1 for search intent only (not factual queries)', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /PRIORITY 1: Flight Search Tool/);
      // search_flights should fire on SEARCH/PRICE/AVAILABILITY intent
      assert.match(prompt, /Use search_flights for FLIGHT SEARCH\/PRICE\/AVAILABILITY/);
      // …but factual airline questions should route to web_search/knowledge_base instead
      assert.match(prompt, /DO NOT use search_flights for FACTUAL questions/);
    });

    it('lists German and English flight trigger keywords', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /"Flug", "Flüge", "fliegen"/);
      assert.match(prompt, /"flight", "flights", "fly", "flying"/);
    });

    it('includes today ISO date for past-date validation', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      const expectedIso = FIXED_DATE.toISOString().split('T')[0];
      assert.ok(prompt.includes(`Today's date is: ${expectedIso}`));
    });

    it('mandates print() for the code_interpreter tool', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /EVERY SINGLE OUTPUT MUST END WITH print\(\)/);
    });

    it('routes general loyalty questions away from get_loyalty_balances', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /Loyalty Balances Tool/);
      assert.match(prompt, /Answer from Loyalty Context in system prompt/);
    });
  });

  describe('RESPONSE_AND_CITATIONS section', () => {
    it('makes citations mandatory and inline', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /CITATIONS ARE MANDATORY/);
      assert.match(prompt, /Citations MUST be placed immediately after/);
    });

    it('forbids citation-grouping headings like References or Sources', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /"Additional Resources", "Further Reading"/);
      assert.match(prompt, /"References", "Citations", "Sources", "Bibliography"/);
    });

    it('defines the citation format as [Source Title](URL)', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /Citation format: \[Source Title\]\(URL\)/);
    });

    it('preserves the GOOD vs BAD citation examples', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /GOOD CITATION EXAMPLE:/);
      assert.match(prompt, /BAD CITATION EXAMPLE \(DO NOT DO THIS\):/);
    });
  });

  describe('LATEX_AND_CURRENCY section', () => {
    it('mandates $ for inline equations and $$ for block equations', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /Use '\$' for ALL inline equations/);
      assert.match(prompt, /Use '\$\$' for ALL block equations/);
    });

    it('forbids using $ as a currency symbol', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /NEVER use '\$' symbol for currency/);
      assert.match(prompt, /Always use "USD", "EUR", etc\./);
    });
  });

  describe('PROHIBITED_ACTIONS section', () => {
    it('lists tool repetition and image inclusion as forbidden', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /Prohibited Actions:/);
      assert.match(prompt, /Do not run tools multiple times/);
      assert.match(prompt, /Do not include images in responses/);
    });
  });

  describe('PRE_OUTPUT_GATE section (A3, DACH voice)', () => {
    it('declares the gate as a blocking, mandatory pre-response check', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /PRE-OUTPUT GATE/);
      assert.match(prompt, /vor jeder Antwort/i);
      assert.match(prompt, /blockierende Pr.fung/i);
    });

    it('lists DACH-Concierge banned action-offer patterns', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      const bannedPatterns = [
        'Soll ich nachschauen?',
        'Soll ich recherchieren?',
        'Soll ich deine Punktest',
        'Ich kann nachschauen, wenn du m',
        'M.chtest du, dass ich',
      ];
      for (const pattern of bannedPatterns) {
        assert.match(prompt, new RegExp(pattern), `expected banned pattern: ${pattern}`);
      }
    });

    it('instructs to delete the question and execute the action instead', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      assert.match(prompt, /L.sche den Satz/i);
      assert.match(prompt, /F.hre die Aktion aus/i);
    });

    it('positions the gate before the CRITICAL INSTRUCTION header', () => {
      const prompt = buildMyloWebSystemPrompt({ now: FIXED_DATE });
      const gateIndex = prompt.indexOf('PRE-OUTPUT GATE');
      const criticalIndex = prompt.indexOf('### CRITICAL INSTRUCTION:');
      assert.ok(gateIndex > 0, 'PRE-OUTPUT GATE must appear in prompt');
      assert.ok(criticalIndex > 0, 'CRITICAL INSTRUCTION must appear in prompt');
      assert.ok(
        gateIndex < criticalIndex,
        `PRE-OUTPUT GATE (${gateIndex}) must come before CRITICAL INSTRUCTION (${criticalIndex})`,
      );
    });
  });
});
