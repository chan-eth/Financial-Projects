'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ThemeToggle } from '@/components/theme-toggle'
import { AssetForm } from '@/components/asset-form'
import { CompoundChart } from '@/components/compound-chart'
import { AssetSummary } from '@/components/asset-summary'
import { Plus } from 'lucide-react'
import { AprApyConverter } from '@/components/apr-apy-converter'
import type { Asset } from '@/types/asset'

function formatFrequency(freq: string): string {
  return freq.charAt(0).toUpperCase() + freq.slice(1)
}

export default function Home() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [showForm, setShowForm] = useState(false)

  const handleAddAsset = (asset: Asset) => {
    setAssets([...assets, asset])
    setShowForm(false)
  }

  const handleRemoveAsset = (id: string) => {
    setAssets(assets.filter((a) => a.id !== id))
  }

  const handleUpdateAsset = (updatedAsset: Asset) => {
    setAssets(assets.map((a) => (a.id === updatedAsset.id ? updatedAsset : a)))
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Compound Interest Calculator
            </h1>
            <p className="text-sm text-muted-foreground">
              Compare multiple assets side-by-side
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Input Section */}
          <Card className="p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Your Assets</h2>
                <p className="text-sm text-muted-foreground">
                  {assets.length === 0
                    ? 'Add your first asset to get started'
                    : `Managing ${assets.length} asset${assets.length === 1 ? '' : 's'}`}
                </p>
              </div>
              {assets.length < 6 && (
                <Button
                  onClick={() => setShowForm(true)}
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Asset
                </Button>
              )}
            </div>

            {showForm && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <AssetForm
                  onSubmit={handleAddAsset}
                  onCancel={() => setShowForm(false)}
                  existingAssets={assets}
                />
              </div>
            )}

            {assets.length > 0 && (
              <div className="mt-6 space-y-4">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center gap-4 rounded-lg border border-border/50 bg-muted/20 p-4 transition-colors hover:bg-muted/40"
                  >
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: asset.color }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ${asset.principal.toLocaleString()} at {asset.rate}% •{' '}
                        {formatFrequency(asset.compound)} • {asset.years} years
                        {asset.recurringAmount && (
                          <> • +${asset.recurringAmount.toLocaleString()}/{formatFrequency(asset.recurringFrequency || 'monthly')}</>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAsset(asset.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Chart Section */}
          {assets.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CompoundChart assets={assets} />
            </div>
          )}

          {/* Summary Cards */}
          {assets.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
              <AssetSummary assets={assets} />
            </div>
          )}

          {/* Empty State */}
          {assets.length === 0 && !showForm && (
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">No assets yet</h3>
                <p className="mb-6 text-sm text-muted-foreground">
                  Start by adding your first investment to see compound growth
                  projections
                </p>
                <Button onClick={() => setShowForm(true)}>
                  Add Your First Asset
                </Button>
              </div>
            </div>
          )}

          {/* APR to APY Converter Section */}
          <div className="pt-8">
            <AprApyConverter />
          </div>
        </div>
      </main>
    </div>
  )
}
