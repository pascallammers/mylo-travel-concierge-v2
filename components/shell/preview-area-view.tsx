import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { PreviewAreaSlug } from '@/lib/shell/preview-areas';
import { NotifyMeButton } from './notify-me-button';

/**
 * Explain a coming feature and offer interest registration.
 * @param props - Preview area and the current user's saved registration state.
 * @returns A localized preview page with an interest button.
 */
export async function PreviewAreaView({ area, registered }: { area: PreviewAreaSlug; registered: boolean }) {
  const t = await getTranslations('shell');

  return (
    <section className="w-full p-4 sm:p-6" aria-labelledby="preview-area-title">
      <div className="mx-auto w-full max-w-3xl">
        <Card>
          <CardHeader className="space-y-3">
            <Badge variant="secondary" className="w-fit">{t('preview.badge')}</Badge>
            <h1 id="preview-area-title" className="text-2xl font-semibold tracking-tight">{t(`areas.${area}`)}</h1>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-base leading-relaxed">{t(`preview.${area}.body`)}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{t('preview.inProgress')}</p>
            <NotifyMeButton key={area} area={area} registered={registered} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
