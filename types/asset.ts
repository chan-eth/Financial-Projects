export type CompoundFrequency = 'monthly' | 'quarterly' | 'annually'

export interface Asset {
  id: string
  name: string
  principal: number
  rate: number
  compound: CompoundFrequency
  years: number
  color: string
  recurringAmount?: number
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually'
}
