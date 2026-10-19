'use client'

import { useState, useTransition } from 'react'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { setOwnImpersonationConsent } from '@/actions/impersonation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

/**
 * The user's own consent for the admin to sign in as them. Only the user can
 * turn this on; the admin can only turn it off.
 */
export function AdminAccessCard({ initialAllowed }: { initialAllowed: boolean }) {
  const [allowed, setAllowed] = useState(initialAllowed)
  const [pending, startTransition] = useTransition()

  function toggle(value: boolean) {
    setAllowed(value)
    startTransition(async () => {
      const { error } = await setOwnImpersonationConsent(value)
      if (error) {
        setAllowed(!value)
        toast.error(error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5" />
          Admin access
        </CardTitle>
        <CardDescription>
          When this is on, the admin of this installation can sign in as you,
          for example to help with a problem. They then see all your data.
          Every session is logged. You can turn it off at any time. If an
          admin is signed in as you when you turn it off, that session ends
          and you are also signed out on your other devices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="admin-access">Allow the admin to sign in as me</Label>
          <Switch
            id="admin-access"
            checked={allowed}
            disabled={pending}
            onCheckedChange={toggle}
          />
        </div>
      </CardContent>
    </Card>
  )
}
