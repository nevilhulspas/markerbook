import type { Metadata } from 'next'

import { RegisterForm } from '@/components/auth/register-form'
import { isGoogleSignInEnabled } from '@/lib/auth/providers'

export const metadata: Metadata = {
  title: 'Register | Markerbook',
}

export default async function RegisterPage() {
  return <RegisterForm googleEnabled={await isGoogleSignInEnabled()} />
}
