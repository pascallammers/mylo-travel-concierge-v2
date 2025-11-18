'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ActivityChartProps {
  data: Array<{
    date: string;
    count: number;
  }>;
  title?: string;
}

/**
 * Redesigned activity chart with gradient area and smooth animations
 */
export function ActivityChart({ data, title = 'Active Users per Day' }: ActivityChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [animatedData, setAnimatedData] = useState(data.map(d => ({ ...d, count: 0 })));

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let progress = 0;
    const animationTimer = setInterval(() => {
      progress += 0.04;
      if (progress >= 1) {
        setAnimatedData(data);
        clearInterval(animationTimer);
      } else {
        setAnimatedData(data.map(d => ({ ...d, count: d.count * progress })));
      }
    }, 16);

    return () => clearInterval(animationTimer);
  }, [isVisible, data]);

  // Format date for display
  const formattedData = animatedData.map((item) => ({
    ...item,
    displayDate: new Date(item.date).toLocaleDateString('de-DE', {
      month: '2-digit',
      day: '2-digit',
    }),
  }));

  return (
    <Card
      className={`
        group relative overflow-hidden border-border/50 bg-gradient-to-br from-card/95 to-card/60
        backdrop-blur-sm transition-all duration-500
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
      `}
    >
      {/* Grain texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <CardHeader className="relative">
        <CardTitle className="font-['Playfair_Display'] text-lg font-semibold tracking-tight">
          {title}
        </CardTitle>
        <div className="mt-1 h-0.5 w-12 rounded-full bg-gradient-to-r from-accent via-primary to-transparent" />
      </CardHeader>

      <CardContent className="relative">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <defs>
              {/* Gradient for the area fill */}
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#0D9488" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#0D9488" stopOpacity={0} />
              </linearGradient>

              {/* Gradient for the line stroke */}
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.9} />
                <stop offset="50%" stopColor="#0EA5E9" stopOpacity={1} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.9} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.2}
              vertical={false}
            />

            <XAxis
              dataKey="displayDate"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.3 }}
              angle={-20}
              textAnchor="end"
              height={60}
            />

            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />

            <Tooltip
              cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                padding: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(8px)',
              }}
              formatter={(value: number) => [
                <span key="value" className="font-['JetBrains_Mono'] font-semibold">
                  {value} Nutzer
                </span>,
                '',
              ]}
              labelStyle={{
                color: 'hsl(var(--foreground))',
                fontWeight: 600,
                marginBottom: '4px',
              }}
            />

            <Area
              type="monotone"
              dataKey="count"
              stroke="url(#lineGradient)"
              strokeWidth={3}
              fill="url(#areaGradient)"
              dot={{
                fill: '#14B8A6',
                stroke: '#fff',
                strokeWidth: 2,
                r: 4,
              }}
              activeDot={{
                fill: '#0EA5E9',
                stroke: '#fff',
                strokeWidth: 3,
                r: 6,
                className: 'drop-shadow-lg',
              }}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Ambient glow effect */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-accent/5 via-transparent to-transparent opacity-60" />
      </CardContent>
    </Card>
  );
}
