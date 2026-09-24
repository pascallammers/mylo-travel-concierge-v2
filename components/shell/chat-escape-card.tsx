import { MessageCircle, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Offer a contextual handoff from an area into Hey Mylo.
 * @param props - Localized copy and encoded new-chat destination.
 * @returns Responsive chat escape card.
 */
export function ChatEscapeCard({ href, title, body, cta }: { href: string; title: string; body: string; cta: string }) {
  return (
    <Card className="bg-muted/40">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <MessageCircle className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{body}</p></div>
        </div>
        <Button asChild variant="outline" className="min-h-11 shrink-0"><a href={href}>{cta}<ArrowUpRight className="size-4" aria-hidden="true" /></a></Button>
      </CardContent>
    </Card>
  );
}
