'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChurnChartProps {
  data: Array<{ month: string; churnRate: number; churned: number }>;
}

/**
 * Monthly churn rate area chart for the KPI dashboard.
 */
export function KPIChurnChart({ data }: ChurnChartProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 400);
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
          Monatliche Churn-Rate
        </CardTitle>
        <div className="mt-1 h-0.5 w-12 rounded-full bg-gradient-to-r from-destructive/60 via-orange-400 to-transparent" />
      </CardHeader>
      <CardContent className="relative">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="churnAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F97316" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
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
              tickFormatter={(v) => `${v}%`}
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
                if (name === 'churnRate') return [`${value}%`, 'Churn-Rate'];
                if (name === 'churned') return [value, 'Kuendigungen'];
                return [value, name];
              }}
            />
            <Area
              type="monotone"
              dataKey="churnRate"
              stroke="#F97316"
              strokeWidth={2}
              fill="url(#churnAreaGradient)"
              dot={{ fill: '#F97316', stroke: '#fff', strokeWidth: 2, r: 3 }}
              activeDot={{ fill: '#EA580C', stroke: '#fff', strokeWidth: 3, r: 5 }}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
