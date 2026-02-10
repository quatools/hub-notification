"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { toast } from "sonner"

interface Club {
  club_id: string
  club_name: string
  club_slug: string
  role: string
}

interface ClubContextValue {
  clubs: Club[]
  selectedClub: Club | null
  loading: boolean
  isAuthenticated: boolean
  selectClub: (clubId: string) => void
}

const ClubContext = createContext<ClubContextValue>({
  clubs: [],
  selectedClub: null,
  loading: true,
  isAuthenticated: true,
  selectClub: () => {},
})

export function ClubProvider({ children }: { children: ReactNode }) {
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(true)

  const fetchClubs = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/clubs")
      if (res.status === 401) {
        setIsAuthenticated(false)
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error()
      const data = await res.json()
      const clubList: Club[] = data.clubs || []
      setClubs(clubList)

      // Auto-select: restore from localStorage or pick the only one
      const savedId = localStorage.getItem("selected_club_id")
      const saved = savedId ? clubList.find((c) => c.club_id === savedId) : null

      if (saved) {
        setSelectedClub(saved)
      } else if (clubList.length === 1) {
        setSelectedClub(clubList[0])
        localStorage.setItem("selected_club_id", clubList[0].club_id)
      }
    } catch {
      toast.error("Erreur lors du chargement de vos clubs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchClubs() }, [fetchClubs])

  const selectClub = (clubId: string) => {
    const club = clubs.find((c) => c.club_id === clubId) || null
    setSelectedClub(club)
    if (club) {
      localStorage.setItem("selected_club_id", club.club_id)
    }
  }

  return (
    <ClubContext.Provider value={{ clubs, selectedClub, loading, isAuthenticated, selectClub }}>
      {children}
    </ClubContext.Provider>
  )
}

export function useClub() {
  return useContext(ClubContext)
}
