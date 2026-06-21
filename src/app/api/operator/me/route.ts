import { NextResponse } from 'next/server'
import { getOperator } from '@/lib/auth/operator'

// GET /api/operator/me — l'appelant est-il opérateur ? (pour afficher le lien menu)
export async function GET() {
  const op = await getOperator()
  return NextResponse.json({ is_operator: !!op })
}
