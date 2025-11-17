'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

type CompoundingFrequency =
  | 'annually'
  | 'semi-annually'
  | 'quarterly'
  | 'monthly'
  | 'weekly'
  | 'daily'
  | 'continuously'

const FREQUENCY_MAP: Record<CompoundingFrequency, number | 'continuous'> = {
  annually: 1,
  'semi-annually': 2,
  quarterly: 4,
  monthly: 12,
  weekly: 52,
  daily: 365,
  continuously: 'continuous',
}

const FREQUENCY_LABELS: Record<CompoundingFrequency, string> = {
  annually: 'Annually',
  'semi-annually': 'Semi-annually',
  quarterly: 'Quarterly',
  monthly: 'Monthly',
  weekly: 'Weekly',
  daily: 'Daily',
  continuously: 'Continuously',
}

function calculateAPY(apr: number, frequency: CompoundingFrequency): number {
  const n = FREQUENCY_MAP[frequency]
  if (n === 'continuous') {
    return (Math.exp(apr) - 1) * 100
  }
  return (Math.pow(1 + apr / n, n) - 1) * 100
}

export function AprApyConverter() {
  const [isOpen, setIsOpen] = useState(false)
  const [apr, setApr] = useState<string>('5')
  const [frequency, setFrequency] =
    useState<CompoundingFrequency>('monthly')

  const aprValue = parseFloat(apr) || 0
  const aprDecimal = aprValue / 100
  const apy = calculateAPY(aprDecimal, frequency)

  // Generate chart data showing progression from APR to APY over one year
  const chartData = Array.from({ length: 13 }, (_, i) => {
    const month = i
    const effectiveRate =
      FREQUENCY_MAP[frequency] === 'continuous'
        ? (Math.exp((aprDecimal * month) / 12) - 1) * 100
        : (Math.pow(
            1 + aprDecimal / (FREQUENCY_MAP[frequency] as number),
            ((FREQUENCY_MAP[frequency] as number) * month) / 12
          ) -
            1) *
          100
    return {
      month,
      rate: month === 0 ? aprValue : aprValue + effectiveRate,
    }
  })

  return (
    <Card className="overflow-hidden">
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between p-6 text-left hover:bg-muted/40"
      >
        <div>
          <h2 className="text-lg font-semibold">APR → APY Converter</h2>
          <p className="text-sm text-muted-foreground">
            See how compounding frequency affects your effective yield
          </p>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </Button>

      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-2 border-t border-border/40 p-6 duration-300">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Inputs */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="apr" className="text-sm font-medium">
                  APR (%)
                </Label>
                <div className="relative">
                  <Input
                    id="apr"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={apr}
                    onChange={(e) => setApr(e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency" className="text-sm font-medium">
                  Compounding Frequency
                </Label>
                <Select
                  value={frequency}
                  onValueChange={(value) =>
                    setFrequency(value as CompoundingFrequency)
                  }
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annually">Annually</SelectItem>
                    <SelectItem value="semi-annually">Semi-annually</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="continuously">Continuously</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10">
                        <Info className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        APR = nominal rate, APY = effective annual yield including
                        compounding
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Result */}
            <div className="rounded-lg border border-border/40 bg-muted/20 p-6 text-center">
              <div className="mb-2 text-4xl font-bold text-foreground">
                {apy.toFixed(2)}% APY
              </div>
              <p className="text-sm text-muted-foreground">
                {aprValue.toFixed(2)}% APR compounded{' '}
                {FREQUENCY_LABELS[frequency].toLowerCase()} yields{' '}
                {apy.toFixed(2)}% effective annual return
              </p>
            </div>

            {/* Chart */}
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={false}
                  />
                  <YAxis hide />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
