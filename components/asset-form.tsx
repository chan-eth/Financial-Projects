'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { Asset, CompoundFrequency } from '@/types/asset'

interface AssetFormProps {
  onSubmit: (asset: Asset) => void
  onCancel: () => void
  existingAssets: Asset[]
}

const PRESET_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#14b8a6', // teal
]

export function AssetForm({ onSubmit, onCancel, existingAssets }: AssetFormProps) {
  const usedColors = new Set(existingAssets.map((a) => a.color))
  const availableColor =
    PRESET_COLORS.find((c) => !usedColors.has(c)) || PRESET_COLORS[0]

  const [name, setName] = useState('')
  const [principal, setPrincipal] = useState('10000')
  const [rate, setRate] = useState('7')
  const [compound, setCompound] = useState<CompoundFrequency>('monthly')
  const [years, setYears] = useState([10])
  const [color, setColor] = useState(availableColor)
  const [hasRecurring, setHasRecurring] = useState(false)
  const [recurringAmount, setRecurringAmount] = useState('500')
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually'>('monthly')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const asset: Asset = {
      id: Math.random().toString(36).slice(2, 11),
      name: name || 'Unnamed Asset',
      principal: parseFloat(principal) || 0,
      rate: parseFloat(rate) || 0,
      compound,
      years: years[0],
      color,
      ...(hasRecurring && {
        recurringAmount: parseFloat(recurringAmount) || 0,
        recurringFrequency,
      }),
    }

    onSubmit(asset)

    // Reset form
    setName('')
    setPrincipal('10000')
    setRate('7')
    setCompound('monthly')
    setYears([10])
    setHasRecurring(false)
    setRecurringAmount('500')
    setRecurringFrequency('monthly')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-border bg-card p-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Asset Name</Label>
          <Input
            id="name"
            placeholder="e.g., S&P 500 Index"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="principal">Initial Investment</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="principal"
              type="number"
              className="pl-7"
              placeholder="10000"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              min="0"
              step="100"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rate">Annual Interest Rate (%)</Label>
          <Input
            id="rate"
            type="number"
            placeholder="7"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            min="0"
            max="100"
            step="0.1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="compound">Compounding Frequency</Label>
          <Select value={compound} onValueChange={(v) => setCompound(v as CompoundFrequency)}>
            <SelectTrigger id="compound">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="annually">Annually</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <div className="flex items-center justify-between">
            <Label>Investment Period</Label>
            <span className="text-sm font-medium">{years[0]} years</span>
          </div>
          <Slider
            value={years}
            onValueChange={setYears}
            min={1}
            max={50}
            step={1}
            className="mt-2"
          />
        </div>

        <div className="space-y-4 md:col-span-2 rounded-lg border border-border/50 bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="recurring-toggle" className="text-base">
                Recurring Investment
              </Label>
              <p className="text-sm text-muted-foreground">
                Add regular contributions to your investment
              </p>
            </div>
            <Switch
              id="recurring-toggle"
              checked={hasRecurring}
              onCheckedChange={setHasRecurring}
            />
          </div>

          {hasRecurring && (
            <div className="grid gap-4 md:grid-cols-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <Label htmlFor="recurring-amount">Contribution Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="recurring-amount"
                    type="number"
                    className="pl-7"
                    placeholder="500"
                    value={recurringAmount}
                    onChange={(e) => setRecurringAmount(e.target.value)}
                    min="0"
                    step="10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recurring-frequency">Contribution Frequency</Label>
                <Select
                  value={recurringFrequency}
                  onValueChange={(v) => setRecurringFrequency(v as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually')}
                >
                  <SelectTrigger id="recurring-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Chart Color</Label>
          <div className="flex gap-2">
            {PRESET_COLORS.map((presetColor) => (
              <button
                key={presetColor}
                type="button"
                onClick={() => setColor(presetColor)}
                className={`h-10 w-10 rounded-md border-2 transition-all ${
                  color === presetColor
                    ? 'scale-110 border-foreground'
                    : 'border-border hover:scale-105'
                }`}
                style={{ backgroundColor: presetColor }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Add Asset</Button>
      </div>
    </form>
  )
}
