'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plane, Clock } from 'lucide-react';
import { AlternativeAirportResponse } from '@/lib/types';

interface AlternativeAirportSelectorProps {
  data: AlternativeAirportResponse;
  onSelectAirport: (newSearch: string) => void;
}

export function AlternativeAirportSelector({
  data,
  onSelectAirport,
}: AlternativeAirportSelectorProps) {
  const [selectedAlternative, setSelectedAlternative] = useState<{
    code: string;
    name: string;
    city: string;
  } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAirportClick = (alt: typeof data.alternatives[0]) => {
    setSelectedAlternative({ code: alt.code, name: alt.name, city: alt.city });
    setIsDialogOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedAlternative) return;

    // Build new search query
    const { originalSearch, alternatives } = data;
    const selectedAlt = alternatives.find(a => a.code === selectedAlternative.code);

    if (!selectedAlt) return;

    // Replace the appropriate airport
    const newOrigin = selectedAlt.replaceType === 'origin'
      ? selectedAlternative.code
      : originalSearch.origin;
    const newDestination = selectedAlt.replaceType === 'destination'
      ? selectedAlternative.code
      : originalSearch.destination;

    // Build natural language search query
    const searchQuery = `Flüge von ${newOrigin} nach ${newDestination} am ${originalSearch.departureDate}${
      originalSearch.returnDate ? ` (Rückflug: ${originalSearch.returnDate})` : ''
    }, ${originalSearch.passengers} ${originalSearch.passengers === 1 ? 'Person' : 'Personen'}, ${originalSearch.cabinClass}`;

    onSelectAirport(searchQuery);
    setIsDialogOpen(false);
    setSelectedAlternative(null);
  };

  return (
    <div className="mt-4">
      {/* Alternative airport buttons */}
      <div className="space-y-2 mt-4">
        <p className="text-sm font-medium text-muted-foreground mb-2">
          Diese Flughäfen sind in der Nähe:
        </p>
        {data.alternatives.map((alt) => (
          <Button
            key={alt.code}
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3 px-4"
            onClick={() => handleAirportClick(alt)}
          >
            <Plane className="h-4 w-4 flex-shrink-0 text-primary" />
            <div className="flex flex-col items-start text-left">
              <span className="font-medium">
                {alt.city} — {alt.name} ({alt.code})
              </span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {alt.distance}
              </span>
            </div>
          </Button>
        ))}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suche mit anderem Flughafen?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAlternative && (
                <>
                  Mit <strong>{selectedAlternative.city} ({selectedAlternative.code})</strong> statt{' '}
                  <strong>{data.alternatives[0]?.originalAirport}</strong> suchen?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Suche starten
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
