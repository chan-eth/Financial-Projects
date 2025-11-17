'use client'

import { Card } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { Asset, CompoundFrequency } from '@/types/asset'

interface CompoundChartProps {
  assets: Asset[]
}

function calculateCompoundInterest(
  principal: number,
  rate: number,
  years: number,
  compound: CompoundFrequency,
  recurringAmount?: number,
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually'
): number[] {
  const frequencies: Record<CompoundFrequency, number> = {
    monthly: 12,
    quarterly: 4,
    annually: 1,
  }

  const n = frequencies[compound]
  const values: number[] = []

  // Calculate recurring contribution per compounding period
  let contributionPerPeriod = 0
  if (recurringAmount && recurringFrequency) {
    const recurringFrequencies: Record<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually', number> = {
      daily: 365,
      weekly: 52,
      monthly: 12,
      quarterly: 4,
      annually: 1,
    }
    const recurringN = recurringFrequencies[recurringFrequency]
    contributionPerPeriod = recurringAmount / (n / recurringN)
  }

  for (let t = 0; t <= years; t++) {
    if (!recurringAmount) {
      // Simple compound interest
      const amount = principal * Math.pow(1 + rate / 100 / n, n * t)
      values.push(Math.round(amount * 100) / 100)
    } else {
      // Compound interest with recurring contributions (future value of annuity)
      const baseAmount = principal * Math.pow(1 + rate / 100 / n, n * t)
      const annuityAmount = contributionPerPeriod * 
        ((Math.pow(1 + rate / 100 / n, n * t) - 1) / (rate / 100 / n))
      values.push(Math.round((baseAmount + annuityAmount) * 100) / 100)
    }
  }

  return values
}

export function CompoundChart({ assets }: CompoundChartProps) {
  // Find the maximum years to determine chart range
  const maxYears = Math.max(...assets.map((a) => a.years))

  // Generate data points
  const data = Array.from({ length: maxYears + 1 }, (_, year) => {
    const point: any = { year }

    assets.forEach((asset) => {
      if (year <= asset.years) {
        const values = calculateCompoundInterest(
          asset.principal,
          asset.rate,
          asset.years,
          asset.compound,
          asset.recurringAmount,
          asset.recurringFrequency
        )
        point[asset.id] = values[year]
      }
    })

    return point
  })

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toFixed(0)}`
  }

  return (
    <Card className="p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Growth Projection</h2>
        <p className="text-sm text-muted-foreground">
          Compare how your investments grow over time
        </p>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="year"
              label={{ value: 'Years', position: 'insideBottom', offset: -5 }}
              className="text-xs text-muted-foreground"
            />
            <YAxis
              tickFormatter={formatCurrency}
              label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
              className="text-xs text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend />
            {assets.map((asset) => (
              <Line
                key={asset.id}
                type="monotone"
                dataKey={asset.id}
                name={asset.name}
                stroke={asset.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
