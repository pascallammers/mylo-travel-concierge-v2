'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TokenUsageChartProps {
  data: Array<{
    email: string;
    tokens: number;
  }>;
  title?: string;
}

/**
 * Redesigned bar chart with sunset gradient and refined aesthetics
 */
export function TokenUsageChart({ data, title = 'Top Users (Tokens / 30 Days)' }: TokenUsageChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [animatedData, setAnimatedData] = useState(data.map(d => ({ ...d, tokens: 0 })));

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let progress = 0;
    const animationTimer = setInterval(() => {
      progress += 0.05;
      if (progress >= 1) {
        setAnimatedData(data);
        clearInterval(animationTimer);
      } else {
        setAnimatedData(data.map(d => ({ ...d, tokens: d.tokens * progress })));
      }
    }, 16);

    return () => clearInterval(animationTimer);
  }, [isVisible, data]);

  // Sunset gradient colors: amber → coral → rose → purple
  const gradientColors = [
    { start: '#F59E0B', end: '#D97706' },  // Amber
    { start: '#F97316', end: '#EA580C' },  // Orange
    { start: '#EF4444', end: '#DC2626' },  // Red
    { start: '#EC4899', end: '#DB2777' },  // Pink
    { start: '#A855F7', end: '#9333EA' },  // Purple
    { start: '#6366F1', end: '#4F46E5' },  // Indigo
  ];

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
        <div className="mt-1 h-0.5 w-12 rounded-full bg-gradient-to-r from-primary via-accent to-transparent" />
      </CardHeader>

      <CardContent className="relative">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={animatedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <defs>
              {gradientColors.map((color, index) => (
                <linearGradient
                  key={`gradient-${index}`}
                  id={`barGradient-${index}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color.start} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={color.end} stopOpacity={0.7} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.2}
              vertical={false}
            />

            <XAxis
              dataKey="email"
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
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
            />

            <Tooltip
              cursor={{ fill: 'hsl(var(--accent))', opacity: 0.1 }}
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
                  {value.toLocaleString()} tokens
                </span>,
                '',
              ]}
              labelStyle={{
                color: 'hsl(var(--foreground))',
                fontWeight: 600,
                marginBottom: '4px',
              }}
            />

            <Bar dataKey="tokens" radius={[8, 8, 0, 0]} maxBarSize={60}>
              {animatedData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#barGradient-${index % gradientColors.length})`}
                  className="transition-opacity hover:opacity-80"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Ambient glow effect */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent opacity-60" />
      </CardContent>
    </Card>
  );
}
