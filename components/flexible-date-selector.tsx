'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Search } from 'lucide-react';
import { FlexibleDateResponse } from '@/lib/types';

interface FlexibleDateSelectorProps {
  data: FlexibleDateResponse;
  onAcceptFlexible: (searchQuery: string) => void;
}

export function FlexibleDateSelector({
  data,
  onAcceptFlexible,
}: FlexibleDateSelectorProps) {
  const handleAccept = () => {
    // Build search query that includes flexibility parameter
    const { originalSearch } = data;

    // Calculate date range for display
    const baseDate = new Date(originalSearch.departureDate);
    const startDate = new Date(baseDate);
    const endDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() - 3);
    endDate.setDate(endDate.getDate() + 3);

    const formatDate = (d: Date) => d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
    });

    // Build natural language search query with flexible dates hint
    const searchQuery = `Fluege von ${originalSearch.originDisplay} nach ${originalSearch.destinationDisplay} zwischen ${formatDate(startDate)} und ${formatDate(endDate)}${
      originalSearch.returnDate ? ` (Rueckflug: ${originalSearch.returnDate})` : ''
    }, ${originalSearch.passengers} ${originalSearch.passengers === 1 ? 'Person' : 'Personen'}, ${originalSearch.cabinClass}, mit flexiblen Daten`;

    onAcceptFlexible(searchQuery);
  };

  // Format the original date for display
  const formattedDate = new Date(data.originalSearch.departureDate).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mt-4 space-y-4">
      {/* Info message */}
      <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
        <Calendar className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">
            Keine Fluege am {formattedDate}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Moechten Sie auch 3 Tage davor und danach suchen?
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleAccept}
          className="flex-1 gap-2"
        >
          <Search className="h-4 w-4" />
          Mit flexiblen Daten suchen
        </Button>
      </div>

      {/* Route summary */}
      <p className="text-xs text-muted-foreground text-center">
        {data.originalSearch.originDisplay} &rarr; {data.originalSearch.destinationDisplay}
      </p>
    </div>
  );
}
