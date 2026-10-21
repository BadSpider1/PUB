import { ChevronRight, Tags } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { AppearanceCard } from '@/components/settings/AppearanceCard'
import { BackupCard } from '@/components/settings/BackupCard'
import { GoogleDriveCard } from '@/components/settings/GoogleDriveCard'
import { InstallCard } from '@/components/settings/InstallCard'
import { LocalFolderCard } from '@/components/settings/LocalFolderCard'
import { StorageOverviewCard } from '@/components/settings/StorageOverviewCard'
import { Card } from '@/components/ui/card'

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Storage, backups and preferences." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <h2 className="sr-only">Storage</h2>
          <StorageOverviewCard />
          <LocalFolderCard />
          <GoogleDriveCard />
          <BackupCard />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="md:hidden">
            <Link to="/categories" className="flex items-center gap-3 p-4">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Tags className="size-[18px]" />
              </span>
              <span className="flex-1">
                <span className="block font-medium">Categories</span>
                <span className="block text-sm text-muted-foreground">Add, edit and delete categories</span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </Card>
          <AppearanceCard />
          <InstallCard />
          <p className="px-1 text-xs text-muted-foreground">
            Personal Finance Vault v{__APP_VERSION__}. Your data stays on your devices and in the vault locations you
            connect – there is no server.
          </p>
        </div>
      </div>
    </>
  )
}
