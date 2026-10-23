import type { Metadata } from 'next'
import Link from 'next/link'

import { getAuditLogs } from '@/actions/admin/audit'
import type { AuditLogRow } from '@/actions/admin/audit'
import { APP_LOCALE } from '@/lib/locale'

export const metadata: Metadata = {
  title: 'Admin | Markerbook',
}

export default async function AdminPage() {
  const { data: logs, error } = await getAuditLogs({ limit: 20 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage biomarker catalog, review suggestions, and verify reference
          ranges.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/users"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Users &amp; impersonation
        </Link>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        {error ? (
          <p className="text-destructive">
            Failed to load audit logs: {error}
          </p>
        ) : !logs || logs.length === 0 ? (
          <p className="text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">Action</th>
                  <th className="px-4 py-2 text-left font-medium">
                    Entity Type
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    Entity ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: AuditLogRow) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      {new Date(log.created_at).toLocaleString(APP_LOCALE)}
                    </td>
                    <td className="px-4 py-2 capitalize">{log.action}</td>
                    <td className="px-4 py-2">{log.entity_type}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {log.entity_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
