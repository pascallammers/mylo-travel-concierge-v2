'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { defaultReviewDue, parseSourceMonth } from '@/lib/valuation/dates';
import { ANCHOR_LABELS, CABIN_LABELS } from '@/lib/valuation/presentation';
import { CABINS, type Anchor, type Cabin } from '@/lib/valuation/types';

interface Props {
  programs: { id: string; name: string }[];
  onSaved: () => Promise<void>;
}

/**
 * Record a successor rate with explicit confirmation of unusually large deviations.
 * @param props - Registry programmes and dashboard refresh callback.
 * @returns Accessible administrator form with six-month review defaults.
 */
export function ValuationRateForm({ programs, onSaved }: Props) {
  const [programId, setProgramId] = useState('lufthansa');
  const [anchor, setAnchor] = useState<Anchor>('travel');
  const [cabin, setCabin] = useState<Cabin>('all');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [due, setDue] = useState(() => defaultReviewDue(parseSourceMonth(month)!).toISOString().slice(0, 10));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saved, setSaved] = useState(false);

  function resetConfirmation() {
    setConflict(false);
    setConfirmed(false);
    setError(null);
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/admin/valuation-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId,
          anchor,
          cabin,
          centsPerUnit: Number(form.get('centsPerUnit')),
          source: form.get('source'),
          sourceUrl: form.get('sourceUrl') || undefined,
          sourceAsOf: month,
          reviewDue: due,
          note: form.get('note') || undefined,
          confirmDeviation: confirmed,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (response.status === 409) {
        setConflict(true);
        setConfirmed(false);
        setError(result.error ?? 'Bitte die Abweichung bestätigen.');
        return;
      }
      if (!response.ok) throw new Error(result.error ?? 'Der Bewertungssatz konnte nicht gespeichert werden.');
      setConflict(false);
      setConfirmed(false);
      setSaved(true);
      await onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-t border-border pt-4">
      <h3 className="text-sm font-medium">Neuen Bewertungssatz erfassen</h3>
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2" onChange={resetConfirmation}>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="valuation-program">Programm</Label>
          <Select
            value={programId}
            disabled={pending}
            onValueChange={(value) => {
              setProgramId(value);
              resetConfirmation();
            }}
          >
            <SelectTrigger id="valuation-program" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {programs.map((program) => (
                <SelectItem key={program.id} value={program.id}>
                  {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="valuation-anchor">Anker</Label>
          <Select
            value={anchor}
            disabled={pending}
            onValueChange={(value: Anchor) => {
              setAnchor(value);
              if (value === 'no_plan') setCabin('all');
              resetConfirmation();
            }}
          >
            <SelectTrigger id="valuation-anchor" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['travel', 'no_plan'] as const).map((value) => (
                <SelectItem key={value} value={value}>
                  {ANCHOR_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="valuation-cabin">Klasse</Label>
          <Select
            value={cabin}
            disabled={pending || anchor === 'no_plan'}
            onValueChange={(value: Cabin) => {
              setCabin(value);
              resetConfirmation();
            }}
          >
            <SelectTrigger id="valuation-cabin" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CABINS.map((value) => (
                <SelectItem key={value} value={value}>
                  {CABIN_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="valuation-value">ct/Punkt</Label>
          <Input
            id="valuation-value"
            name="centsPerUnit"
            type="number"
            min="0.001"
            max="999.999"
            step="0.001"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valuation-source">Quelle</Label>
          <Input id="valuation-source" name="source" defaultValue="reisetopia" maxLength={200} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valuation-url">Quellen-URL</Label>
          <Input id="valuation-url" name="sourceUrl" type="url" maxLength={2000} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valuation-month">Stand</Label>
          <Input
            id="valuation-month"
            type="month"
            value={month}
            required
            onChange={(event) => {
              const value = event.target.value;
              setMonth(value);
              const parsed = parseSourceMonth(value);
              setDue(parsed ? defaultReviewDue(parsed).toISOString().slice(0, 10) : '');
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valuation-due">Fällig</Label>
          <Input id="valuation-due" type="date" value={due} required onChange={(event) => setDue(event.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="valuation-note">Notiz</Label>
          <Textarea id="valuation-note" name="note" maxLength={2000} />
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-muted-foreground">
          Bewertungssatz gespeichert.
        </p>
      )}
      {conflict && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="valuation-confirm"
            checked={confirmed}
            disabled={pending}
            onCheckedChange={(checked) => setConfirmed(checked === true)}
          />
          <Label htmlFor="valuation-confirm">Abweichung bestätigen</Label>
        </div>
      )}
      <Button type="submit" disabled={pending || (conflict && !confirmed)}>
        {pending ? 'Wird gespeichert …' : 'Bewertungssatz speichern'}
      </Button>
    </form>
  );
}
