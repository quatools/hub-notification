"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Globe, Loader2, Copy, CheckCircle2, XCircle, Clock, RefreshCw, Trash2 } from "lucide-react"

interface DnsRecord {
  name: string
  value: string
}

interface DomainState {
  sender_domain: string | null
  sender_local_part: string
  domain_status: string
  dns_records: { spf: DnsRecord; dkim: DnsRecord; dmarc: DnsRecord; mx: DnsRecord } | null
  last_error: string | null
}

const RECORD_TYPES: Array<{ key: keyof NonNullable<DomainState["dns_records"]>; type: string }> = [
  { key: "spf", type: "TXT" },
  { key: "dkim", type: "TXT" },
  { key: "dmarc", type: "TXT" },
  { key: "mx", type: "MX" },
]

export function SendingDomainCard({ orgId }: { orgId: string }) {
  const [domain, setDomain] = useState<DomainState | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [newDomain, setNewDomain] = useState("")

  const fetchDomain = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/settings/domain?org_id=${orgId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDomain(data.domain)
    } catch {
      toast.error("Erreur lors du chargement du domaine d'envoi")
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { fetchDomain() }, [fetchDomain])

  const handleAdd = async () => {
    setWorking(true)
    try {
      const res = await fetch("/api/admin/settings/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, domain: newDomain }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de l'enregistrement")
        return
      }
      setDomain(data.domain)
      toast.success("Domaine enregistré — ajoutez les enregistrements DNS ci-dessous")
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setWorking(false)
    }
  }

  const handleCheck = async () => {
    setWorking(true)
    try {
      const res = await fetch("/api/admin/settings/domain", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la vérification")
        return
      }
      setDomain(data.domain)
      if (data.domain.domain_status === "verified") {
        toast.success("Domaine vérifié ! Vos emails partent désormais de votre domaine.")
      } else {
        toast.info("Vérification en cours côté Scaleway — réessayez dans une minute si les DNS viennent d'être posés.")
      }
    } catch {
      toast.error("Erreur lors de la vérification")
    } finally {
      setWorking(false)
    }
  }

  const handleDelete = async () => {
    setWorking(true)
    try {
      const res = await fetch(`/api/admin/settings/domain?org_id=${orgId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setNewDomain("")
      await fetchDomain()
      toast.success("Domaine supprimé")
    } catch {
      toast.error("Erreur lors de la suppression")
    } finally {
      setWorking(false)
    }
  }

  const copyValue = (value: string) => {
    navigator.clipboard.writeText(value)
    toast.success("Copié")
  }

  const statusBadge = () => {
    switch (domain?.domain_status) {
      case "verified":
        return <Badge className="text-xs bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Vérifié</Badge>
      case "pending":
        return <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />En attente des DNS</Badge>
      case "failed":
        return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Échec</Badge>
      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Domaine d&apos;envoi personnalisé
          {statusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-24" />
        ) : !domain?.sender_domain ? (
          <>
            <p className="text-sm text-muted-foreground">
              Envoyez vos emails directement depuis votre propre domaine
              (ex: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">notifications@monclub.fr</code>),
              sans aucune mention de Quatools. Entrez votre domaine, puis ajoutez les enregistrements
              DNS chez votre hébergeur (OVH, Cloudflare, Gandi…).
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label htmlFor="domain">Votre domaine</Label>
                <Input
                  id="domain"
                  placeholder="monclub.fr"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="w-64"
                />
              </div>
              <Button onClick={handleAdd} disabled={working || !newDomain.trim()}>
                {working && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Ajouter mon domaine
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                {domain.domain_status === "verified" ? (
                  <>Vos emails partent de{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                      {domain.sender_local_part}@{domain.sender_domain}
                    </code>
                  </>
                ) : (
                  <>Domaine <span className="font-semibold">{domain.sender_domain}</span> — une fois
                    vérifié, vos emails partiront de{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {domain.sender_local_part}@{domain.sender_domain}
                    </code>
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                {domain.domain_status !== "verified" && (
                  <Button variant="outline" size="sm" onClick={handleCheck} disabled={working}>
                    {working ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                    Vérifier maintenant
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer ce domaine d&apos;envoi ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Vos emails repartiront de l&apos;adresse par défaut du hub. Vous pourrez
                        reconfigurer un domaine à tout moment.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {domain.domain_status === "failed" && domain.last_error && (
              <p className="text-sm text-destructive">{domain.last_error}</p>
            )}

            {domain.domain_status !== "verified" && domain.dns_records && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Ajoutez ces enregistrements dans la zone DNS de votre domaine, puis cliquez
                  sur « Vérifier maintenant ». La vérification peut prendre quelques minutes
                  après la pose (et Scaleway re-vérifie automatiquement ensuite).
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Nom</th>
                        <th className="px-3 py-2 font-medium">Valeur</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {RECORD_TYPES.map(({ key, type }) => {
                        const record = domain.dns_records![key]
                        if (!record) return null
                        return (
                          <tr key={key} className="border-b last:border-0">
                            <td className="px-3 py-2 font-mono text-xs">{type}</td>
                            <td className="max-w-44 truncate px-3 py-2 font-mono text-xs" title={record.name}>{record.name}</td>
                            <td className="max-w-72 truncate px-3 py-2 font-mono text-xs" title={record.value}>{record.value}</td>
                            <td className="px-3 py-2">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyValue(record.value)}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
