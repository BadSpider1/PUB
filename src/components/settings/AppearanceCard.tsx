import { Monitor, Moon, Palette, Sun } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label, Select } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { CURRENCIES } from '@/lib/money'
import { type ThemePreference, useSettingsStore } from '@/store/useSettingsStore'

export function AppearanceCard() {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const currency = useSettingsStore((s) => s.currency)
  const setCurrency = useSettingsStore((s) => s.setCurrency)
  const currencies: string[] = CURRENCIES.includes(currency as (typeof CURRENCIES)[number])
    ? [...CURRENCIES]
    : [currency, ...CURRENCIES]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="size-5 text-muted-foreground" /> Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Theme</span>
          <SegmentedControl<ThemePreference>
            label="Theme"
            value={theme}
            onChange={setTheme}
            className="w-full sm:w-auto"
            options={[
              { value: 'dark', label: (<><Moon /> Dark</>) },
              { value: 'light', label: (<><Sun /> Light</>) },
              { value: 'system', label: (<><Monitor /> System</>) },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="currency">Currency</Label>
          <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="sm:w-48">
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">Display only – amounts are stored as plain numbers.</p>
        </div>
      </CardContent>
    </Card>
  )
}
