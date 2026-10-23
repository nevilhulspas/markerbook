// Usage: npm run make-admin -- <email-or-user-id>
// Without an argument it uses the first address in ADMIN_EMAIL. This is the only
// way to grant the admin role: signing up never does, because without enforced
// e-mail confirmation anyone could register with the admin's address.

import { createClient } from '@supabase/supabase-js'

try {
  process.loadEnvFile('.env.local')
} catch {
  // no .env.local: rely on the environment
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY environment variables'
  )
  process.exit(1)
}

const arg = process.argv[2] ?? (process.env.ADMIN_EMAIL ?? '').split(',')[0]?.trim()

if (!arg) {
  console.error('Usage: npm run make-admin -- <email-or-user-id>')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function main() {
  let userId = arg
  let email = arg

  // If arg looks like an email, look up the user ID
  if (arg.includes('@')) {
    const { data, error } = await supabase.auth.admin.listUsers()

    if (error) {
      console.error('Failed to list users:', error.message)
      process.exit(1)
    }

    const user = data.users.find((u) => u.email?.toLowerCase() === arg.toLowerCase())

    if (!user) {
      console.error(`No user found with email: ${arg}`)
      process.exit(1)
    }

    userId = user.id
    email = user.email ?? arg
  }

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role: 'admin' },
  })

  if (error) {
    console.error('Failed to set admin role:', error.message)
    process.exit(1)
  }

  console.log(`Admin role set for user: ${data.user.email ?? email} (${userId})`)
}

main()
