'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  iconClassName?: string;
  delay?: number;
}

/**
 * Redesigned statistics card with refined aesthetics and animations
 */
export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName = 'text-muted-foreground',
  delay = 0,
}: StatsCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState<string | number>(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!isVisible) return;

    // Animate numbers if value is numeric
    if (typeof value === 'number') {
      let current = 0;
      const increment = value / 30;
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(current));
        }
      }, 16);
      return () => clearInterval(timer);
    } else {
      setDisplayValue(value);
    }
  }, [isVisible, value]);

  return (
    <Card
      className={`
        group relative overflow-hidden border-border/50 bg-gradient-to-br from-card/95 to-card/60
        backdrop-blur-sm transition-all duration-500 hover:shadow-xl hover:shadow-primary/5
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
      `}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Animated gradient border */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {/* Grain texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-['Be_Vietnam_Pro'] text-sm font-medium tracking-wide text-muted-foreground/90">
          {title}
        </CardTitle>
        <div className="rounded-lg bg-primary/10 p-2 transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20">
          <Icon className={`h-4 w-4 transition-colors duration-300 ${iconClassName}`} />
        </div>
      </CardHeader>

      <CardContent className="relative">
        <div className="font-['JetBrains_Mono'] text-3xl font-bold tracking-tight">
          {displayValue}
        </div>
        {description && (
          <p className="mt-1 font-['Be_Vietnam_Pro'] text-xs text-muted-foreground/70">
            {description}
          </p>
        )}

        {/* Subtle glow effect */}
        <div className="absolute -bottom-2 left-1/2 h-8 w-1/2 -translate-x-1/2 rounded-full bg-primary/5 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
      </CardContent>
    </Card>
  );
}
