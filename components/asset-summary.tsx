'use client'

import { Card } from '@/components/ui/card'
import type { Asset, CompoundFrequency } from '@/types/asset'
import { TrendingUp, DollarSign, Percent } from 'lucide-react'

interface AssetSummaryProps {
  assets: Asset[]
}

function calculateFinalValues(asset: Asset) {
  const frequencies: Record<CompoundFrequency, number> = {
    monthly: 12,
    quarterly: 4,
    annually: 1,
  }

  const n = frequencies[asset.compound]
  let finalAmount: number
  let totalContributions = asset.principal

  if (!asset.recurringAmount) {
    // Simple compound interest
    finalAmount = asset.principal * Math.pow(1 + asset.rate / 100 / n, n * asset.years)
  } else {
    // Compound interest with recurring contributions
    const recurringFrequencies: Record<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually', number> = {
      daily: 365,
      weekly: 52,
      monthly: 12,
      quarterly: 4,
      annually: 1,
    }
    const recurringN = recurringFrequencies[asset.recurringFrequency || 'monthly']
    const contributionPerPeriod = asset.recurringAmount / (n / recurringN)
    
    const baseAmount = asset.principal * Math.pow(1 + asset.rate / 100 / n, n * asset.years)
    const annuityAmount = contributionPerPeriod * 
      ((Math.pow(1 + asset.rate / 100 / n, n * asset.years) - 1) / (asset.rate / 100 / n))
    
    finalAmount = baseAmount + annuityAmount
    totalContributions = asset.principal + (asset.recurringAmount * (asset.years * recurringN))
  }

  const totalInterest = finalAmount - totalContributions
  const percentageGrowth = ((finalAmount - totalContributions) / totalContributions) * 100

  return {
    finalAmount: Math.round(finalAmount * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    percentageGrowth: Math.round(percentageGrowth * 100) / 100,
    totalContributions: Math.round(totalContributions * 100) / 100,
  }
}

export function AssetSummary({ assets }: AssetSummaryProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Summary</h2>
        <p className="text-sm text-muted-foreground">
          Final projections for each asset
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => {
          const { finalAmount, totalInterest, percentageGrowth, totalContributions } =
            calculateFinalValues(asset)

          return (
            <Card
              key={asset.id}
              className="p-6 transition-all hover:shadow-lg"
            >
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: asset.color }}
                />
                <h3 className="font-semibold text-balance">{asset.name}</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Final Balance</p>
                    <p className="text-xl font-bold">
                      ${finalAmount.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Interest Earned</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      ${totalInterest.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Growth</p>
                    <p className="text-xl font-bold">
                      {percentageGrowth.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {asset.recurringAmount && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">
                      Total Contributions: ${totalContributions.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
