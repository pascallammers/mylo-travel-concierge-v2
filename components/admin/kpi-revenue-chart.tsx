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
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RevenueChartProps {
  data: Array<{ month: string; revenue: number; subscribers: number }>;
}

/**
 * Monthly revenue bar chart for the KPI dashboard.
 */
export function KPIRevenueChart({ data }: RevenueChartProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.month + '-01').toLocaleDateString('de-DE', {
      month: 'short',
      year: '2-digit',
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
      <CardHeader className="relative">
        <CardTitle className="font-['Playfair_Display'] text-lg font-semibold tracking-tight">
          Monatlicher Umsatz
        </CardTitle>
        <div className="mt-1 h-0.5 w-12 rounded-full bg-gradient-to-r from-primary via-accent to-transparent" />
      </CardHeader>
      <CardContent className="relative">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#0D9488" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.2}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.3 }}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}€`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                padding: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'revenue') return [`${value}€`, 'Umsatz'];
                if (name === 'subscribers') return [value, 'Neue Abonnenten'];
                return [value, name];
              }}
            />
            <Bar
              dataKey="revenue"
              fill="url(#barGradient)"
              radius={[6, 6, 0, 0]}
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
