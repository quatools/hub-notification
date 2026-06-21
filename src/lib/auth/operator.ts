/**
 * Opérateurs (super-admin) du hub : accès à la console de validation des apps
 * self-service. Liste par email via `OPERATOR_EMAILS` (CSV) ; défaut : le compte
 * fondateur, pour que la console fonctionne sans configuration supplémentaire.
 */
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'

const OPERATOR_EMAILS = (process.env.OPERATOR_EMAILS || 'alexandre.quatools@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export function isOperatorEmail(email?: string | null): boolean {
  return !!email && OPERATOR_EMAILS.includes(email.toLowerCase())
}

/** L'utilisateur connecté s'il est opérateur, sinon `null`. */
export async function getOperator() {
  const user = await getAuthenticatedUser()
  if (!user || !isOperatorEmail(user.email)) return null
  return user
}
