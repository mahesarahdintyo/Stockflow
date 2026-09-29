'use client'

import React, { useMemo, useState, useEffect, useRef, Fragment } from 'react'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpDown,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  Boxes,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardList,
  Download,
  Edit2,
  FileSpreadsheet,
  Filter,
  History,
  LayoutDashboard,
  Lock,
  Maximize2,
  Minimize2,
  Moon,
  MoreHorizontal,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Tv,
  User,
  Warehouse,
  X,
} from 'lucide-react'

export interface PartItem {
  id: string
  coil: string
  spec: string
  part: string
  line: string
  opening: number
  active: boolean
}

export interface MovementItem {
  id: string
  partId: string
  date: string
  type: 'IN' | 'OUT'
  qty: number
  note: string
  operator?: string
  role?: string
}

export type UserRole = 'RECEIVING' | 'PRODUCTION' | 'SUPERVISOR'
export type MonthlySortField = 'id' | 'part' | 'line' | 'stokAwal' | 'totalIn' | 'totalOut' | 'finalSisa' | 'currentStock'

export interface RoleConfig {
  id: UserRole
  name: string
  label: string
  description: string
  allowedTypes: ('IN' | 'OUT')[]
  badgeColor: string
}

export const ROLES: Record<UserRole, RoleConfig> = {
  SUPERVISOR: {
    id: 'SUPERVISOR',
    name: 'Warehouse Admin',
    label: 'Full Access (IN & OUT)',
    description: 'Akses penuh pencatatan barang masuk & keluar',
    allowedTypes: ['IN', 'OUT'],
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  RECEIVING: {
    id: 'RECEIVING',
    name: 'Operator Receiving',
    label: 'Hanya IN (Masuk)',
    description: 'Penerimaan material baru dari supplier',
    allowedTypes: ['IN'],
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  },
  PRODUCTION: {
    id: 'PRODUCTION',
    name: 'Operator Produksi',
    label: 'Hanya OUT (Keluar)',
    description: 'Pengambilan material untuk pemakaian line',
    allowedTypes: ['OUT'],
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-300',
  },
}

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Stock Movement', icon: ClipboardList },
  { label: 'Master Part', icon: Boxes },
  { label: 'Report', icon: BarChart3 },
  { label: 'Riwayat', icon: History },
]

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

/** PKIS-PLUS Date & Time Helper Functions */
function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLocalTimeString(d: Date = new Date()): string {
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function parseDateTimeString(dtStr?: string): { date: string; time: string } {
  if (!dtStr) {
    return { date: getLocalDateString(), time: getLocalTimeString() }
  }
  if (dtStr.includes('T')) {
    const [d, t] = dtStr.split('T')
    return { date: d || getLocalDateString(), time: (t || '').slice(0, 5) }
  }
  if (dtStr.includes(' ')) {
    const [d, t] = dtStr.split(' ')
    return { date: d || getLocalDateString(), time: (t || '').slice(0, 5) }
  }
  return { date: dtStr.slice(0, 10), time: dtStr.length > 10 ? dtStr.slice(11, 16) : '' }
}

function fmt(iso?: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtClock(iso?: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Konversi ISO/datetime string → nilai untuk input[type=datetime-local]
 * Standar PKIS-PLUS: toLocalInput()
 */
function toLocalInput(dtStr?: string | null): string {
  if (!dtStr) return ''
  const d = new Date(dtStr.includes('T') ? dtStr : dtStr.replace(' ', 'T'))
  if (isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`
}

const HOUR_DIAL_NUMBERS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTE_DIAL_NUMBERS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

export default function Page() {
  const [activePage, setActivePage] = useState('Dashboard')
  
  // Data state - default empty (semua dummy data dihapus)
  const [parts, setParts] = useState<PartItem[]>([])
  const [movements, setMovements] = useState<MovementItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Modals state
  const [showMovementForm, setShowMovementForm] = useState(false)
  const [showPartForm, setShowPartForm] = useState(false)

  // Filters state
  const [query, setQuery] = useState('')
  const [lineFilter, setLineFilter] = useState('All lines')

  // Stock Movement (Stock Bulanan) states
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${yyyy}-${mm}`
  })
  const [monthlyItemFilter, setMonthlyItemFilter] = useState('ALL')
  const [monthlyLineFilter, setMonthlyLineFilter] = useState('All lines')
  const [monthlySearch, setMonthlySearch] = useState('')
  const [stockMovementView, setStockMovementView] = useState<'matrix' | 'list'>('matrix')
  const [monthlySortField, setMonthlySortField] = useState<MonthlySortField>('id')
  const [monthlySortDir, setMonthlySortDir] = useState<'asc' | 'desc'>('asc')

  // Theme state: 'light' | 'dark' | 'system' — pola PKIS-PLUS
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  function applyThemeToDOM(t: 'light' | 'dark' | 'system') {
    const html = document.documentElement
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const effectiveDark = t === 'dark' || (t === 'system' && prefersDark)
    if (effectiveDark) {
      html.classList.add('dark')
      html.classList.remove('light')
    } else {
      html.classList.add('light')
      html.classList.remove('dark')
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('stockflow.theme') as 'light' | 'dark' | 'system' | null
      const initial = (saved === 'dark' || saved === 'light' || saved === 'system') ? saved : 'system'
      setTheme(initial)
      applyThemeToDOM(initial)
    } catch {
      applyThemeToDOM('system')
    }
  }, [])

  function toggleTheme() {
    setTheme((prev) => {
      // cycle: system → light → dark → system
      const next: 'light' | 'dark' | 'system' =
        prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system'
      try {
        applyThemeToDOM(next)
        localStorage.setItem('stockflow.theme', next)
      } catch { /* ignore */ }
      return next
    })
  }

  // Derived: effective dark flag — dipakai untuk conditional inline styling
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  // Fullscreen TV 52" mode
  const [isTvFullscreen, setIsTvFullscreen] = useState(false)
  const tvContainerRef = useRef<HTMLDivElement>(null)
  const [currentClock, setCurrentClock] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    function onFullscreenChange() {
      setIsTvFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  function handleToggleTvFullscreen() {
    setStockMovementView('matrix')
    if (!document.fullscreenElement) {
      if (tvContainerRef.current?.requestFullscreen) {
        tvContainerRef.current.requestFullscreen().catch(() => {
          setIsTvFullscreen(true)
        })
      } else {
        setIsTvFullscreen(true)
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          setIsTvFullscreen(false)
        })
      } else {
        setIsTvFullscreen(false)
      }
    }
  }

  // Role state (RBAC Simulator)
  const [currentRole, setCurrentRole] = useState<UserRole>('SUPERVISOR')

  // Stock Movement type filter
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL')

  // Riwayat filter state
  const [riwayatFromDate, setRiwayatFromDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return getLocalDateString(d)
  })
  const [riwayatToDate, setRiwayatToDate] = useState(() => getLocalDateString())
  const [riwayatPartFilter, setRiwayatPartFilter] = useState('ALL')
  const [riwayatTypeFilter, setRiwayatTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL')
  const [riwayatSearch, setRiwayatSearch] = useState('')
  const [riwayatPage, setRiwayatPage] = useState(1)
  const RIWAYAT_PAGE_SIZE = 20

  // Movement Form fields — PKIS-PLUS style: single datetime-local
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null)
  const [movType, setMovType] = useState<'IN' | 'OUT'>('IN')
  const [selectedPartId, setSelectedPartId] = useState('')
  const [movQty, setMovQty] = useState('100')
  const [movDatetime, setMovDatetime] = useState(() => toLocalInput(new Date().toISOString()))
  const [movNote, setMovNote] = useState('')
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [clockMode, setClockMode] = useState<'hours' | 'minutes'>('hours')
  const [selectedH12, setSelectedH12] = useState<number>(12)
  const [selectedMin, setSelectedMin] = useState<number>(0)
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM')
  const dialRef = useRef<HTMLDivElement>(null)

  const { date: movDatePart, time: movTimePart } = useMemo(() => {
    return parseDateTimeString(movDatetime)
  }, [movDatetime])

  function handleSetTime(newHour: string, newMinute: string) {
    const d = movDatePart || getLocalDateString()
    const h = String(newHour).padStart(2, '0')
    const m = String(newMinute).padStart(2, '0')
    setMovDatetime(`${d}T${h}:${m}`)
  }

  function handleOpenTimePicker() {
    const { time } = parseDateTimeString(movDatetime)
    const [hStr, mStr] = (time || '00:00').split(':')
    const h24 = parseInt(hStr || '0', 10)
    const m = parseInt(mStr || '0', 10)
    setPeriod(h24 >= 12 ? 'PM' : 'AM')
    setSelectedH12(h24 % 12 || 12)
    setSelectedMin(isNaN(m) ? 0 : m)
    setClockMode('hours')
    setShowTimePicker(true)
  }

  function handleConfirmTimePicker() {
    let h24 = selectedH12 % 12
    if (period === 'PM') h24 += 12
    const hStr = String(h24).padStart(2, '0')
    const mStr = String(selectedMin).padStart(2, '0')
    handleSetTime(hStr, mStr)
    setShowTimePicker(false)
  }

  function handleResetTimePickerNow() {
    const now = new Date()
    const h24 = now.getHours()
    const m = now.getMinutes()
    setPeriod(h24 >= 12 ? 'PM' : 'AM')
    setSelectedH12(h24 % 12 || 12)
    setSelectedMin(m)
  }

  function handleDialPointer(e: React.PointerEvent<HTMLDivElement>) {
    if (!dialRef.current) return
    const rect = dialRef.current.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    const x = e.clientX - rect.left - cx
    const y = e.clientY - rect.top - cy
    let deg = Math.atan2(y, x) * (180 / Math.PI) + 90
    if (deg < 0) deg += 360

    if (clockMode === 'hours') {
      let h = Math.round(deg / 30) % 12
      if (h === 0) h = 12
      setSelectedH12(h)
    } else {
      let m = Math.round(deg / 6) % 60
      setSelectedMin(m)
    }
  }

  const preview24 = useMemo(() => {
    let h24 = selectedH12 % 12
    if (period === 'PM') h24 += 12
    return `${String(h24).padStart(2, '0')}:${String(selectedMin).padStart(2, '0')}`
  }, [selectedH12, selectedMin, period])

  const handAngle = clockMode === 'hours' ? (selectedH12 % 12) * 30 : selectedMin * 6

  function handleSetDate(newDate: string) {
    const t = movTimePart || getLocalTimeString()
    setMovDatetime(`${newDate}T${t}`)
  }

  // Part Form fields
  const [partId, setPartId] = useState('')
  const [partCoil, setPartCoil] = useState('')
  const [partSpec, setPartSpec] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [partLine, setPartLine] = useState('')
  const [partOpening, setPartOpening] = useState('0')

  // Load from localStorage on mount (tanpa perlu akun Supabase)
  useEffect(() => {
    try {
      const savedParts = localStorage.getItem('stockflow_parts')
      const savedMovements = localStorage.getItem('stockflow_movements')
      const savedRole = localStorage.getItem('stockflow_role') as UserRole
      if (savedParts) {
        const parsed = JSON.parse(savedParts)
        if (Array.isArray(parsed)) setParts(parsed)
      }
      if (savedMovements) {
        const parsed = JSON.parse(savedMovements)
        if (Array.isArray(parsed)) setMovements(parsed)
      }
      if (savedRole && ROLES[savedRole]) {
        setCurrentRole(savedRole)
      }
    } catch (e) {
      console.error('Failed to load local data:', e)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Auto-save role
  useEffect(() => {
    if (!isLoaded) return
    localStorage.setItem('stockflow_role', currentRole)
  }, [currentRole, isLoaded])

  // Auto-save to localStorage
  useEffect(() => {
    if (!isLoaded) return
    localStorage.setItem('stockflow_parts', JSON.stringify(parts))
  }, [parts, isLoaded])

  useEffect(() => {
    if (!isLoaded) return
    localStorage.setItem('stockflow_movements', JSON.stringify(movements))
  }, [movements, isLoaded])

  // Calculation helpers
  const partStats = useMemo(() => {
    const statsMap: Record<string, { inQty: number; outQty: number; currentStock: number }> = {}
    
    parts.forEach((p) => {
      statsMap[p.id] = { inQty: 0, outQty: 0, currentStock: p.opening }
    })

    movements.forEach((m) => {
      if (!statsMap[m.partId]) {
        statsMap[m.partId] = { inQty: 0, outQty: 0, currentStock: 0 }
      }
      if (m.type === 'IN') {
        statsMap[m.partId].inQty += m.qty
        statsMap[m.partId].currentStock += m.qty
      } else {
        statsMap[m.partId].outQty += m.qty
        statsMap[m.partId].currentStock -= m.qty
      }
    })

    return statsMap
  }, [parts, movements])

  const totals = useMemo(() => {
    const inTotal = movements.filter((m) => m.type === 'IN').reduce((sum, m) => sum + m.qty, 0)
    const outTotal = movements.filter((m) => m.type === 'OUT').reduce((sum, m) => sum + m.qty, 0)
    const openingTotal = parts.reduce((sum, p) => sum + p.opening, 0)
    const current = openingTotal + inTotal - outTotal
    return { inTotal, outTotal, openingTotal, current }
  }, [parts, movements])

  // Lines distribution
  const lineDistribution = useMemo(() => {
    const lineMap: Record<string, number> = {}
    parts.forEach((p) => {
      const stock = partStats[p.id]?.currentStock ?? p.opening
      lineMap[p.line] = (lineMap[p.line] || 0) + stock
    })

    const totalStock = Object.values(lineMap).reduce((acc, curr) => acc + curr, 0)
    const colors = ['bg-[#eab308]', 'bg-[#607d8b]', 'bg-[#29934b]', 'bg-[#3b82f6]', 'bg-[#8b5cf6]']

    return Object.entries(lineMap).map(([lineName, stock], idx) => ({
      label: lineName,
      amount: formatNumber(stock),
      value: totalStock > 0 ? Math.max(5, Math.round((stock / totalStock) * 100)) : 0,
      color: colors[idx % colors.length],
    }))
  }, [parts, partStats])

  // Visible movements based on filters
  const visibleMovements = useMemo(() => {
    return movements.filter((movement) => {
      const part = parts.find((p) => p.id === movement.partId)
      const matchesLine = lineFilter === 'All lines' || part?.line === lineFilter
      const matchesType = movementTypeFilter === 'ALL' || movement.type === movementTypeFilter
      const queryTarget = `${movement.id} ${movement.partId} ${part?.part || ''} ${part?.coil || ''} ${movement.note}`.toLowerCase()
      const matchesQuery = !query || queryTarget.includes(query.toLowerCase())
      return matchesLine && matchesType && matchesQuery
    })
  }, [movements, parts, lineFilter, movementTypeFilter, query])

  // Available unique lines
  const availableLines = useMemo(() => {
    const set = new Set<string>()
    parts.forEach((p) => {
      if (p.line) set.add(p.line)
    })
    return Array.from(set)
  }, [parts])

  // Month navigation handlers for Stock Bulanan
  function handlePrevMonth() {
    const [y, m] = (selectedMonth || '2026-09').split('-').map(Number)
    const prev = new Date(y, m - 2, 1)
    const yyyy = prev.getFullYear()
    const mm = String(prev.getMonth() + 1).padStart(2, '0')
    setSelectedMonth(`${yyyy}-${mm}`)
  }

  function handleNextMonth() {
    const [y, m] = (selectedMonth || '2026-09').split('-').map(Number)
    const next = new Date(y, m, 1)
    const yyyy = next.getFullYear()
    const mm = String(next.getMonth() + 1).padStart(2, '0')
    setSelectedMonth(`${yyyy}-${mm}`)
  }

  function handleCurrentMonth() {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    setSelectedMonth(`${yyyy}-${mm}`)
  }

  // Monthly Matrix metadata (days, dates, label)
  const monthMeta = useMemo(() => {
    const [y, m] = (selectedMonth || '2026-09').split('-').map(Number)
    const daysCount = new Date(y, m, 0).getDate()
    const daysList = Array.from({ length: daysCount }, (_, i) => i + 1)
    const dObj = new Date(y, m - 1, 1)
    const labelIndo = dObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    return {
      year: y,
      month: m,
      daysCount,
      daysList,
      labelIndo,
    }
  }, [selectedMonth])

  // Filtered parts for Stock Bulanan
  const filteredMonthlyParts = useMemo(() => {
    return parts.filter((p) => {
      const matchItem = monthlyItemFilter === 'ALL' || p.id === monthlyItemFilter
      const matchLine = monthlyLineFilter === 'All lines' || p.line === monthlyLineFilter
      const queryTarget = `${p.id} ${p.part} ${p.spec} ${p.coil} Line ${p.line}`.toLowerCase()
      const matchSearch = !monthlySearch || queryTarget.includes(monthlySearch.toLowerCase())
      return matchItem && matchLine && matchSearch
    })
  }, [parts, monthlyItemFilter, monthlyLineFilter, monthlySearch])

  // Monthly Matrix Data (AWAL, IN, OUT, SISA per day 01..31)
  const monthlyMatrixData = useMemo(() => {
    const monthStartStr = `${selectedMonth}-01`
    const todayStr = getLocalDateString()

    const rawList = filteredMonthlyParts.map((p) => {
      // 1. Calculate opening balance as of the first day of selectedMonth
      let priorStock = p.opening
      for (const m of movements) {
        if (m.partId === p.id) {
          const mDateOnly = m.date.slice(0, 10)
          if (mDateOnly < monthStartStr) {
            if (m.type === 'IN') priorStock += m.qty
            else if (m.type === 'OUT') priorStock -= m.qty
          }
        }
      }

      // 2. Pre-filter all movements for this part in selectedMonth
      const monthMovs = movements.filter(
        (m) => m.partId === p.id && m.date.slice(0, 7) === selectedMonth
      )

      // 3. Compute daily progression
      let runningStock = priorStock
      let totalMonthIn = 0
      let totalMonthOut = 0

      const daily = monthMeta.daysList.map((dayNum) => {
        const dayStr = `${selectedMonth}-${String(dayNum).padStart(2, '0')}`
        const dayDate = new Date(monthMeta.year, monthMeta.month - 1, dayNum)
        const dayOfWeekShort = dayDate.toLocaleDateString('id-ID', { weekday: 'short' })
        const isToday = dayStr === todayStr

        let dayIn = 0
        let dayOut = 0
        for (const m of monthMovs) {
          if (m.date.startsWith(dayStr)) {
            if (m.type === 'IN') dayIn += m.qty
            else if (m.type === 'OUT') dayOut += m.qty
          }
        }

        const awal = runningStock
        const sisa = awal + dayIn - dayOut
        runningStock = sisa
        totalMonthIn += dayIn
        totalMonthOut += dayOut

        return {
          dayNum: String(dayNum).padStart(2, '0'),
          dayStr,
          dayOfWeekShort,
          isToday,
          awal,
          inQty: dayIn,
          outQty: dayOut,
          sisa,
        }
      })

      const finalSisa = daily.length > 0 ? daily[daily.length - 1].sisa : priorStock

      return {
        part: p,
        priorStock,
        daily,
        totalIn: totalMonthIn,
        totalOut: totalMonthOut,
        finalSisa,
      }
    })

    return rawList.sort((a, b) => {
      let cmp = 0
      if (monthlySortField === 'id') {
        cmp = a.part.id.localeCompare(b.part.id, undefined, { numeric: true })
      } else if (monthlySortField === 'part') {
        cmp = a.part.part.localeCompare(b.part.part)
      } else if (monthlySortField === 'line') {
        cmp = a.part.line.localeCompare(b.part.line, undefined, { numeric: true })
      } else if (monthlySortField === 'stokAwal') {
        const stockA = a.daily[0]?.awal ?? a.priorStock
        const stockB = b.daily[0]?.awal ?? b.priorStock
        cmp = stockA - stockB
      } else if (monthlySortField === 'totalIn') {
        cmp = a.totalIn - b.totalIn
      } else if (monthlySortField === 'totalOut') {
        cmp = a.totalOut - b.totalOut
      } else if (monthlySortField === 'finalSisa') {
        cmp = a.finalSisa - b.finalSisa
      } else if (monthlySortField === 'currentStock') {
        const stockA = partStats[a.part.id]?.currentStock ?? a.part.opening
        const stockB = partStats[b.part.id]?.currentStock ?? b.part.opening
        cmp = stockA - stockB
      }
      return monthlySortDir === 'asc' ? cmp : -cmp
    })
  }, [filteredMonthlyParts, movements, selectedMonth, monthMeta, monthlySortField, monthlySortDir, partStats])

  // Summary stats for monthly matrix
  const monthlyTotals = useMemo(() => {
    const totalParts = filteredMonthlyParts.length
    const totalIn = monthlyMatrixData.reduce((acc, cur) => acc + cur.totalIn, 0)
    const totalOut = monthlyMatrixData.reduce((acc, cur) => acc + cur.totalOut, 0)
    const totalFinalStock = monthlyMatrixData.reduce((acc, cur) => acc + cur.finalSisa, 0)
    return { totalParts, totalIn, totalOut, totalFinalStock }
  }, [filteredMonthlyParts, monthlyMatrixData])

  // Export Stock Bulanan to Excel (CSV with UTF-8 BOM)
  function handleExportMonthlyStockExcel() {
    if (monthlyMatrixData.length === 0) {
      alert('Tidak ada data material untuk diekspor.')
      return
    }
    const dayHeaders = monthMeta.daysList.map((d) => String(d).padStart(2, '0'))
    const headers = ['KODE PART', 'NAMA PART', 'SPEC', 'LINE', 'DATA', ...dayHeaders, 'TOTAL']
    const rows: (string | number)[][] = []

    monthlyMatrixData.forEach((item) => {
      // Row AWAL
      rows.push([
        item.part.id,
        `"${item.part.part}"`,
        `"${item.part.spec}"`,
        item.part.line,
        'AWAL',
        ...item.daily.map((d) => d.awal),
        item.daily[0]?.awal ?? item.priorStock,
      ])
      // Row IN
      rows.push([
        item.part.id,
        `"${item.part.part}"`,
        `"${item.part.spec}"`,
        item.part.line,
        'IN',
        ...item.daily.map((d) => d.inQty),
        item.totalIn,
      ])
      // Row OUT
      rows.push([
        item.part.id,
        `"${item.part.part}"`,
        `"${item.part.spec}"`,
        item.part.line,
        'OUT',
        ...item.daily.map((d) => d.outQty),
        item.totalOut,
      ])
      // Row SISA
      rows.push([
        item.part.id,
        `"${item.part.part}"`,
        `"${item.part.spec}"`,
        item.part.line,
        'SISA',
        ...item.daily.map((d) => d.sisa),
        item.finalSisa,
      ])
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Stock_Bulanan_${selectedMonth}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Riwayat filtered movements
  const riwayatFiltered = useMemo(() => {
    return movements.filter((m) => {
      const mDateOnly = m.date.slice(0, 10)
      const inDateRange = (!riwayatFromDate || mDateOnly >= riwayatFromDate) && (!riwayatToDate || mDateOnly <= riwayatToDate)
      const matchesPart = riwayatPartFilter === 'ALL' || m.partId === riwayatPartFilter
      const matchesType = riwayatTypeFilter === 'ALL' || m.type === riwayatTypeFilter
      const part = parts.find((p) => p.id === m.partId)
      const searchTarget = `${m.partId} ${part?.part || ''} ${m.note} ${m.id} ${m.date}`.toLowerCase()
      const matchesSearch = !riwayatSearch || searchTarget.includes(riwayatSearch.toLowerCase())
      return inDateRange && matchesPart && matchesType && matchesSearch
    }).sort((a, b) => {
      // Sort by datetime desc, then by id desc
      if (b.date !== a.date) return b.date.localeCompare(a.date)
      return b.id.localeCompare(a.id)
    })
  }, [movements, parts, riwayatFromDate, riwayatToDate, riwayatPartFilter, riwayatTypeFilter, riwayatSearch])

  const riwayatTotalPages = Math.max(1, Math.ceil(riwayatFiltered.length / RIWAYAT_PAGE_SIZE))
  const riwayatPagedData = riwayatFiltered.slice(
    (riwayatPage - 1) * RIWAYAT_PAGE_SIZE,
    riwayatPage * RIWAYAT_PAGE_SIZE
  )

  function handleRiwayatSearch() {
    setRiwayatPage(1)
  }

  function handleRiwayatReset() {
    const d = new Date()
    d.setDate(1)
    setRiwayatFromDate(getLocalDateString(d))
    setRiwayatToDate(getLocalDateString())
    setRiwayatPartFilter('ALL')
    setRiwayatTypeFilter('ALL')
    setRiwayatSearch('')
    setRiwayatPage(1)
  }

  // Add Part handler
  function handleAddPart(e: React.FormEvent) {
    e.preventDefault()
    if (!partId.trim()) return

    const newPart: PartItem = {
      id: partId.trim().toUpperCase(),
      coil: partCoil.trim() || partId.trim().toUpperCase(),
      spec: partSpec.trim() || '-',
      part: partNumber.trim() || partId.trim().toUpperCase(),
      line: partLine.trim().toUpperCase() || '-',
      opening: Number(partOpening) || 0,
      active: true,
    }

    setParts((prev) => [newPart, ...prev.filter((p) => p.id !== newPart.id)])
    setSelectedPartId(newPart.id)
    handleClosePartForm()
  }

  function handleOpenPartForm() {
    setPartId('')
    setPartCoil('')
    setPartSpec('')
    setPartNumber('')
    setPartLine('')
    setPartOpening('0')
    setShowPartForm(true)
  }

  function handleClosePartForm() {
    setShowPartForm(false)
    setPartId('')
    setPartCoil('')
    setPartSpec('')
    setPartNumber('')
    setPartLine('')
    setPartOpening('0')
  }

  function handleOpenMovementForm() {
    if (parts.length === 0) {
      alert('Silakan tambah Master Part terlebih dahulu sebelum mencatat pergerakan stok.')
      handleOpenPartForm()
      return
    }
    if (!selectedPartId && parts.length > 0) {
      setSelectedPartId(parts[0].id)
    }
    // Set default movType according to active role
    if (currentRole === 'RECEIVING') {
      setMovType('IN')
    } else if (currentRole === 'PRODUCTION') {
      setMovType('OUT')
    }
    setEditingMovementId(null)
    setMovDatetime(toLocalInput(new Date().toISOString()))
    setMovQty('100')
    setMovNote('')
    setShowTimePicker(false)
    setShowMovementForm(true)
  }

  /** Pre-fill form dari row yang diklik — pola PKIS-PLUS handleEditProductionRow */
  function handleEditMovement(m: MovementItem) {
    // Supervisor bisa edit semua; operator hanya bisa edit milik role-nya
    if (currentRole !== 'SUPERVISOR' && m.role !== currentRole) {
      alert('Anda tidak berwenang mengedit transaksi ini.')
      return
    }
    setEditingMovementId(m.id)
    setSelectedPartId(m.partId)
    setMovType(m.type)
    setMovQty(String(m.qty))
    setMovDatetime(toLocalInput(m.date))
    setMovNote(m.note === '-' ? '' : m.note)
    setShowMovementForm(true)
  }

  function handleCloseMovementForm() {
    setShowMovementForm(false)
    setShowTimePicker(false)
    setEditingMovementId(null)
    setMovNote('')
  }

  // Save Movement (add or edit) with Role Enforcement — pola PKIS-PLUS
  function handleAddMovement() {
    const qty = Number(movQty)
    if (!selectedPartId || !qty || qty < 1) return

    // Enforce role permission
    if (!ROLES[currentRole].allowedTypes.includes(movType)) {
      alert(`Role ${ROLES[currentRole].name} tidak diizinkan mencatat transaksi tipe ${movType}!`)
      return
    }

    // Format ISO 8601 standard PKIS-PLUS — simpan dari datetime-local value
    const fullDate = movDatetime || toLocalInput(new Date().toISOString())

    if (editingMovementId) {
      // Mode EDIT: update existing movement
      setMovements((prev) =>
        prev.map((m) =>
          m.id === editingMovementId
            ? { ...m, partId: selectedPartId, date: fullDate, type: movType, qty, note: movNote.trim() || '-' }
            : m
        )
      )
    } else {
      // Mode ADD: tambah baru
      const newMov: MovementItem = {
        id: `TRX-${String(movements.length + 1).padStart(4, '0')}`,
        partId: selectedPartId,
        date: fullDate,
        type: movType,
        qty,
        note: movNote.trim() || '-',
        operator: ROLES[currentRole].name,
        role: currentRole,
      }
      setMovements((prev) => [newMov, ...prev])
    }

    setShowMovementForm(false)
    setShowTimePicker(false)
    setEditingMovementId(null)
    setMovQty('100')
    setMovNote('')
  }

  // Delete transaction
  function handleDeleteMovement(id: string) {
    if (confirm('Hapus transaksi ini?')) {
      setMovements((prev) => prev.filter((m) => m.id !== id))
    }
  }

  // Delete part
  function handleDeletePart(id: string) {
    if (confirm(`Hapus master part ${id}? Data transaksi terkait juga akan dihapus.`)) {
      setParts((prev) => prev.filter((p) => p.id !== id))
      setMovements((prev) => prev.filter((m) => m.partId !== id))
    }
  }

  // Reset all data
  function handleResetAll() {
    if (confirm('Yakin ingin menghapus SEMUA data dan memulai dari nol lagi?')) {
      setParts([])
      setMovements([])
      localStorage.removeItem('stockflow_parts')
      localStorage.removeItem('stockflow_movements')
    }
  }

  // Quick export CSV
  function handleExportCSV() {
    if (parts.length === 0) {
      alert('Belum ada data barang untuk diekspor.')
      return
    }
    const headers = ['Part ID', 'Part Number', 'Coil', 'Spec', 'Line', 'Opening Stock', 'Total IN', 'Total OUT', 'Current Stock']
    const rows = parts.map((p) => {
      const stats = partStats[p.id] || { inQty: 0, outQty: 0, currentStock: p.opening }
      return [p.id, `"${p.part}"`, `"${p.coil}"`, `"${p.spec}"`, p.line, p.opening, stats.inQty, stats.outQty, stats.currentStock]
    })
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Stock_Report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen transition-colors" style={{ backgroundColor: 'var(--sf-page-bg)', color: 'var(--foreground)' }}>
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col text-white lg:flex border-r border-white/10"
        style={{ backgroundColor: 'var(--sf-sidebar-bg)' }}
      >
        <div className="flex h-[82px] items-center gap-3 border-b border-white/10 px-7">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl font-bold"
                      style={{ backgroundColor: 'var(--sf-brand)', color: 'var(--sf-brand-text)' }}
          >
            <Warehouse size={22} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-wide">STOCKFLOW</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Production control</p>
          </div>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
          <nav className="space-y-1">
            {navItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => setActivePage(label)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${
                  activePage === label
                    ? 'font-bold shadow-lg'
                    : 'text-slate-300 hover:text-white'
                }`}
                style={
                  activePage === label
                    ? { backgroundColor: 'var(--sf-brand)', color: 'var(--sf-brand-text)', borderLeft: '3px solid var(--sf-sidebar-active-border)' }
                    : { color: 'rgba(200,220,230,0.85)' }
                }
                onMouseEnter={(e) => { if (activePage !== label) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--sf-sidebar-hover)' }}
                onMouseLeave={(e) => { if (activePage !== label) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '' }}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto space-y-1 border-t border-white/10 p-4">
          <button
            onClick={handleResetAll}
            title="Hapus semua data lokal untuk mulai dari kosong lagi"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-rose-400 hover:bg-white/5 transition"
          >
            <RotateCcw size={16} /> Reset Semua Data
          </button>
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-white/5 p-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
              style={{ backgroundColor: 'var(--sf-brand)', color: 'var(--sf-brand-text)' }}
            >
              OP
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">User Operator</p>
              <p className="truncate text-[10px] text-emerald-400">● Mode Lokal (No Cloud)</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-[248px]">
        {/* Top Navbar */}
        <header
          className="flex h-[82px] items-center justify-between px-5 sm:px-9 transition-colors"
          style={{ backgroundColor: 'var(--sf-header-bg)', borderBottom: '1px solid var(--sf-header-border)' }}
        >
          <div>
            <p className="text-xs font-medium text-slate-400">Production Inventory / {activePage}</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>{activePage}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Theme Toggle — cycle: system → light → dark (PKIS-PLUS pattern) */}
            <button
              type="button"
              id="theme-toggle-btn"
              onClick={toggleTheme}
              title={
                theme === 'system' ? 'Mode Sistem — klik untuk Mode Terang'
                : theme === 'light' ? 'Mode Terang — klik untuk Mode Gelap'
                : 'Mode Gelap — klik untuk Mode Sistem'
              }
              className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-xs transition active:scale-95"
              style={isDark
                ? { background: 'var(--sf-card-bg)', borderColor: 'var(--border)', color: 'var(--sf-brand)' }
                : { background: 'var(--sf-brand-dim)', borderColor: '#99f6e4', color: 'var(--sf-brand)' }
              }
            >
              {theme === 'dark' ? (
                <><Moon size={15} /><span className="hidden sm:inline">Gelap</span></>
              ) : theme === 'light' ? (
                <><Sun size={15} /><span className="hidden sm:inline">Terang</span></>
              ) : (
                <><Sun size={15} className="opacity-60" /><span className="hidden sm:inline">Sistem</span></>
              )}
            </button>

            {/* Role Switcher Simulator */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-800/90 dark:border-slate-700 px-3 py-1.5 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <ShieldCheck size={14} className="text-[#a17e00]" />
                <span className="hidden sm:inline">Role:</span>
              </div>
              <select
                id="role-switcher-select"
                value={currentRole}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole
                  setCurrentRole(newRole)
                  if (newRole === 'RECEIVING') setMovType('IN')
                  else if (newRole === 'PRODUCTION') setMovType('OUT')
                }}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-1"
              >
                <option value="SUPERVISOR">👑 Warehouse Admin (Full)</option>
                <option value="RECEIVING">📥 Operator Receiving (IN)</option>
                <option value="PRODUCTION">📤 Operator Produksi (OUT)</option>
              </select>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLES[currentRole].badgeColor}`}
              >
                {ROLES[currentRole].label}
              </span>
            </div>

            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Penyimpanan Browser
            </span>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] p-5 sm:p-9">
          {/* DASHBOARD PAGE */}
          {activePage === 'Dashboard' && (
            <div className="tab-fade-in">
              <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="mb-1 text-sm text-slate-500">Overview pergerakan stok real-time</p>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold">Ringkasan Gudang</h2>
                    <span className="rounded-full bg-[#e7f5eb] px-2.5 py-1 text-[11px] font-bold text-[#29934b]">
                      Ready untuk input
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleOpenPartForm}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition"
                  >
                    <Boxes size={16} /> + Master Part
                  </button>
                  <button
                    onClick={handleOpenMovementForm}
                    className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-sm transition"
                    style={{ backgroundColor: 'var(--sf-sidebar-bg)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = theme === 'dark' ? '#2c3945' : '#0f766e')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--sf-sidebar-bg)')}
                  >
                    <Plus size={16} /> Input Pergerakan
                  </button>
                </div>
              </div>

              {/* Stat Cards */}
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total Master Part"
                  value={formatNumber(parts.length)}
                  detail="Barang terdaftar"
                  icon={Boxes}
                  tone="blue"
                />
                <StatCard
                  label="Total Barang Masuk (IN)"
                  value={formatNumber(totals.inTotal)}
                  detail={`${movements.filter((m) => m.type === 'IN').length} transaksi`}
                  icon={ArrowDownToLine}
                  tone="green"
                />
                <StatCard
                  label="Total Barang Keluar (OUT)"
                  value={formatNumber(totals.outTotal)}
                  detail={`${movements.filter((m) => m.type === 'OUT').length} transaksi`}
                  icon={ArrowUpFromLine}
                  tone="orange"
                />
                <StatCard
                  label="Total Stok Saat Ini"
                  value={formatNumber(totals.current)}
                  detail="Semua production line"
                  icon={PackageCheck}
                  tone="yellow"
                />
              </section>

              {/* Main Grid: Movements & Line breakdown */}
              <div className="mt-7 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
                <section className="rounded-xl border shadow-sm"
                  style={{ borderColor: 'var(--sf-header-border)', backgroundColor: 'var(--sf-card-bg)' }}
                >
                  <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center"
                    style={{ borderColor: 'var(--sf-header-border)' }}
                  >
                    <div>
                      <h3 className="font-bold">Transaksi Terkini</h3>
                      <p className="mt-1 text-xs text-slate-400">Riwayat transaksi masuk & keluar terbaru</p>
                    </div>
                    <button
                      onClick={() => setActivePage('Stock Movement')}
                      className="text-xs font-bold hover:underline"
                      style={{ color: 'var(--sf-brand)' }}
                    >
                      Lihat Semua Transaksi →
                    </button>
                  </div>
                  <MovementTable
                    movements={visibleMovements.slice(0, 5)}
                    parts={parts}
                    onDelete={handleDeleteMovement}
                    onAddNew={handleOpenMovementForm}
                    onEdit={handleEditMovement}
                  />
                </section>

                <section className="rounded-xl border shadow-sm flex flex-col justify-between"
                  style={{ borderColor: 'var(--sf-header-border)', backgroundColor: 'var(--sf-card-bg)' }}
                >
                  <div>
                    <div className="border-b p-5" style={{ borderColor: 'var(--sf-header-border)' }}>
                      <h3 className="font-bold">Distribusi Stok per Line</h3>
                      <p className="mt-1 text-xs text-slate-400">Keseimbangan stok pada setiap jalur produksi</p>
                    </div>
                    <div className="space-y-5 p-5">
                      {lineDistribution.length === 0 ? (
                        <p className="text-center py-8 text-xs text-slate-400">
                          Belum ada data barang terdaftar.
                        </p>
                      ) : (
                        lineDistribution.map((item) => (
                          <LineBar
                            key={item.label}
                            label={item.label}
                            value={item.value}
                            amount={item.amount}
                            color={item.color}
                          />
                        ))
                      )}
                    </div>
                  </div>
                  <div
                    className="m-5 rounded-lg p-3.5 text-xs border"
                    style={theme === 'dark'
                      ? { background: 'rgba(244,196,48,0.06)', borderColor: 'rgba(244,196,48,0.18)', color: '#d4a017' }
                      : { background: '#f0fdfa', borderColor: '#99f6e4', color: '#0f766e' }
                    }
                  >
                    <p className="font-bold mb-0.5">ℹ️ Mode Mandiri (Tanpa Akun)</p>
                    <p className="text-[11px] leading-relaxed opacity-80">
                      Semua data yang Anda input otomatis tersimpan di penyimpanan lokal browser Anda. Anda bebas menguji coba input transaksi tanpa perlu registrasi atau membuat akun Supabase.
                    </p>
                  </div>
                </section>
              </div>

              {/* Part Table Section */}
              <section className="mt-6 rounded-xl border shadow-sm"
                style={{ borderColor: 'var(--sf-header-border)', backgroundColor: 'var(--sf-card-bg)' }}
              >
                <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center"
                  style={{ borderColor: 'var(--sf-header-border)' }}
                >
                  <div>
                    <h3 className="font-bold">Status Stok Master Part</h3>
                    <p className="mt-1 text-xs text-slate-400">Pantau jumlah stok real-time per barang</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cari kode/part..."
                        className="w-48 rounded-lg border py-2 pl-9 pr-3 text-xs outline-none transition"
                        style={{ borderColor: 'var(--sf-header-border)', background: 'var(--sf-card-bg)', color: 'var(--foreground)' }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--sf-brand)')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--sf-header-border)')}
                      />
                    </div>
                    <button
                      onClick={handleOpenPartForm}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition"
                      style={{ backgroundColor: 'var(--sf-sidebar-bg)' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = theme === 'dark' ? '#2c3945' : '#0f766e')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--sf-sidebar-bg)')}
                    >
                      <Plus size={14} /> Tambah Part
                    </button>
                  </div>
                </div>
                <PartTable
                  parts={parts.filter(
                    (p) =>
                      !query ||
                      `${p.id} ${p.coil} ${p.part} ${p.spec} ${p.line}`.toLowerCase().includes(query.toLowerCase())
                  )}
                  partStats={partStats}
                  onDelete={handleDeletePart}
                  onAddNew={handleOpenPartForm}
                />
              </section>
            </div>
          )}

          {/* STOCK MOVEMENT (STOCK BULANAN) PAGE */}
          {activePage === 'Stock Movement' && (
            <div
              ref={tvContainerRef}
              className={
                isTvFullscreen
                  ? `fixed inset-0 z-50 flex flex-col h-screen overflow-hidden p-2 sm:p-3 transition-colors duration-200 ${
                      theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                    }`
                  : 'relative tab-fade-in'
              }
              style={isTvFullscreen ? { backgroundColor: 'var(--sf-page-bg)' } : undefined}
            >
              {/* Specialized Fullscreen TV 52" Compact Top Bar (when in TV Mode) */}
              {isTvFullscreen ? (
                <div
                  className={`mb-2 flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-1.5 rounded-xl shadow-xl shrink-0 border transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-900/95 border-slate-700/80 text-white'
                      : 'bg-white border-slate-300 text-slate-800 shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/20 text-amber-500 dark:text-amber-400 border border-amber-400/30">
                      <Tv size={17} strokeWidth={2.5} />
                    </div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xs sm:text-sm font-black tracking-wider uppercase">
                        ANDON TV 52&quot; &bull; STOCK BULANAN
                      </h1>
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {monthMeta.labelIndo} ({monthlyMatrixData.length} Part)
                      </span>
                    </div>
                  </div>

                  {/* Sorting & Filter controls directly on TV Top Bar */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
                        theme === 'dark' ? 'bg-slate-950/90 border-slate-700' : 'bg-slate-50 border-slate-300'
                      }`}
                    >
                      <ArrowUpDown size={13} className="text-amber-500" />
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                        Sortir:
                      </span>
                      <select
                        value={monthlySortField}
                        onChange={(e) => setMonthlySortField(e.target.value as MonthlySortField)}
                        className={`h-7 rounded px-2 text-xs font-semibold outline-none cursor-pointer border ${
                          theme === 'dark'
                            ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400'
                            : 'bg-white border-slate-300 text-slate-800 focus:border-teal-500'
                        }`}
                      >
                        <option value="id">Kode Part</option>
                        <option value="part">Nama Part</option>
                        <option value="line">Line</option>
                        <option value="finalSisa">Sisa Stok Akhir</option>
                        <option value="currentStock">⚡ Stok Terkini</option>
                        <option value="totalIn">Total Masuk (IN)</option>
                        <option value="totalOut">Total Keluar (OUT)</option>
                        <option value="stokAwal">Stok Awal Bulan</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setMonthlySortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                        title={monthlySortDir === 'asc' ? 'Urutan: Naik (A-Z / Terkecil)' : 'Urutan: Turun (Z-A / Terbesar)'}
                        className={`h-7 px-2 rounded border text-xs font-bold flex items-center gap-1 transition active:scale-95 ${
                          theme === 'dark'
                            ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                      >
                        {monthlySortDir === 'asc' ? '↑ Naik' : '↓ Turun'}
                      </button>
                    </div>

                    {/* Quick Line filter for TV */}
                    <div
                      className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
                        theme === 'dark' ? 'bg-slate-950/90 border-slate-700' : 'bg-slate-50 border-slate-300'
                      }`}
                    >
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        Line:
                      </span>
                      <select
                        value={monthlyLineFilter}
                        onChange={(e) => setMonthlyLineFilter(e.target.value)}
                        className={`h-7 rounded px-2 text-xs font-semibold outline-none cursor-pointer border ${
                          theme === 'dark'
                            ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400'
                            : 'bg-white border-slate-300 text-slate-800 focus:border-teal-500'
                        }`}
                      >
                        <option value="All lines">Semua Line</option>
                        {availableLines.map((l) => (
                          <option key={l} value={l}>
                            Line {l}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Digital Clock & Actions */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg border ${
                        theme === 'dark' ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-50 border-slate-300'
                      }`}
                    >
                      <Clock size={13} className="text-amber-500 animate-pulse" />
                      <span className="font-mono font-bold text-xs tracking-wider text-amber-500 dark:text-amber-300">
                        {currentClock.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}{' '}
                        <span className="text-[10px] text-slate-400">WIB</span>
                      </span>
                    </div>

                    {/* Theme Switcher Toggle in TV Mode */}
                    <button
                      type="button"
                      onClick={toggleTheme}
                      title={theme === 'dark' ? 'Ganti ke Mode Terang (Light Mode)' : 'Ganti ke Mode Gelap (Dark Mode)'}
                      className={`h-8 px-2.5 rounded-lg border font-bold text-xs flex items-center gap-1.5 transition active:scale-95 ${
                        theme === 'dark'
                          ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                      }`}
                    >
                      {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-teal-600" />}
                      <span className="hidden sm:inline">{theme === 'dark' ? 'Terang' : 'Gelap'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportMonthlyStockExcel}
                      title="Export Excel"
                      className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1 shadow-sm transition active:scale-95"
                    >
                      <FileSpreadsheet size={14} />
                      <span className="hidden sm:inline">Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleTvFullscreen}
                      className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition active:scale-95"
                    >
                      <Minimize2 size={14} />
                      <span>Keluar (Esc)</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Standard Top Header Bar */
                <div
                  className="mb-6 rounded-2xl p-4 sm:p-5 shadow-sm border flex flex-wrap items-center justify-between gap-4 transition-colors"
                  style={{
                    backgroundColor: 'var(--sf-card-bg)',
                    borderColor: 'var(--sf-header-border)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl shadow-inner transition-colors"
                      style={{
                        backgroundColor: 'var(--sf-brand-light)',
                        color: 'var(--sf-brand)',
                        border: '1px solid var(--sf-brand-light)',
                      }}
                    >
                      <ClipboardList size={22} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Stock Bulanan</h2>
                        <span className="hidden sm:inline-block rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Laporan Harian
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Monitoring saldo awal, mutasi masuk/keluar, dan sisa stok harian selama 1 bulan penuh
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActivePage('Dashboard')}
                      title="Kembali ke Dashboard Utama"
                      className="px-4 py-2 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white text-xs font-extrabold uppercase tracking-wider shadow-sm transition active:scale-95 flex items-center gap-1.5"
                    >
                      <ChevronLeft size={15} /> KEMBALI
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleTvFullscreen}
                      title="Buka tampilan fullscreen di layar TV 52 inch"
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm transition active:scale-95 flex items-center gap-1.5"
                    >
                      <Tv size={15} />
                      <span>Mode TV 52&quot;</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenMovementForm}
                      className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition active:scale-95"
                      style={{
                        backgroundColor: 'var(--sf-brand)',
                        color: theme === 'dark' ? '#17202b' : '#ffffff',
                      }}
                    >
                      <Plus size={16} /> Input Mutasi
                    </button>
                  </div>
                </div>
              )}

              {/* Non-table content: Only rendered when NOT in TV Fullscreen to maximize screen space for TV */}
              {!isTvFullscreen && (
                <div>
                  {/* View Switcher & Quick Stat Badges */}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex rounded-xl p-1 border bg-slate-200/80 border-slate-300">
                      <button
                        type="button"
                        onClick={() => setStockMovementView('matrix')}
                        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                          stockMovementView === 'matrix'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FileSpreadsheet size={14} className={stockMovementView === 'matrix' ? 'text-emerald-600' : ''} />
                        Matriks Bulanan (Tabel Harian)
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockMovementView('list')}
                        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                          stockMovementView === 'list'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <History size={14} className={stockMovementView === 'list' ? 'text-indigo-600' : ''} />
                        Log Daftar Mutasi
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <span>Periode Aktif:</span>
                      <span className="font-bold px-2.5 py-1 rounded-lg border shadow-xs bg-white text-slate-800 border-slate-200">
                        📅 {monthMeta.labelIndo} ({monthMeta.daysCount} Hari)
                      </span>
                    </div>
                  </div>

                  {/* Filter Card */}
                  <div className="rounded-2xl border p-5 shadow-sm mb-5 bg-white border-slate-200 text-slate-800">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      {/* BULAN */}
                      <div className="md:col-span-4 space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider block text-slate-500">
                          BULAN
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handlePrevMonth}
                            title="Bulan Sebelumnya"
                            className="h-10 w-9 rounded-xl border flex items-center justify-center font-bold active:scale-95 transition border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <div className="relative flex-1">
                            <input
                              type="month"
                              value={selectedMonth}
                              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                              className="w-full h-10 rounded-xl border px-3 font-semibold text-xs outline-none border-slate-200 bg-white text-slate-800 focus:border-teal-500 dark:focus:border-[#f4c430]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleNextMonth}
                            title="Bulan Berikutnya"
                            className="h-10 w-9 rounded-xl border flex items-center justify-center font-bold active:scale-95 transition border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
                          >
                            <ChevronRight size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={handleCurrentMonth}
                            title="Kembali ke Bulan Berjalan"
                            className="h-10 px-2.5 rounded-xl border font-bold text-[10px] active:scale-95 transition border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700"
                          >
                            Bulan Ini
                          </button>
                        </div>
                      </div>

                      {/* ITEM (STANDAR: SEMUA ITEM) */}
                      <div className="md:col-span-3 space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider block text-slate-500">
                          ITEM (STANDAR: SEMUA ITEM)
                        </label>
                        <select
                          value={monthlyItemFilter}
                          onChange={(e) => setMonthlyItemFilter(e.target.value)}
                          className="w-full h-10 rounded-xl border px-3 text-xs font-semibold outline-none border-slate-200 bg-white text-slate-800 focus:border-teal-500 dark:focus:border-[#f4c430]"
                        >
                          <option value="ALL">SEMUA ITEM</option>
                          {parts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.id} - {p.part} (Line {p.line})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* LINE FILTER */}
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider block text-slate-500">
                          LINE
                        </label>
                        <select
                          value={monthlyLineFilter}
                          onChange={(e) => setMonthlyLineFilter(e.target.value)}
                          className="w-full h-10 rounded-xl border px-3 text-xs font-semibold outline-none border-slate-200 bg-white text-slate-800 focus:border-teal-500 dark:focus:border-[#f4c430]"
                        >
                          <option value="All lines">Semua Line</option>
                          {availableLines.map((l) => (
                            <option key={l} value={l}>
                              Line {l}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* EXPORT EXCEL BUTTON */}
                      <div className="md:col-span-3 flex justify-end">
                        <button
                          type="button"
                          onClick={handleExportMonthlyStockExcel}
                          className="w-full h-10 rounded-xl bg-[#107c41] hover:bg-[#0c6233] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
                        >
                          <FileSpreadsheet size={16} />
                          <span>EXPORT EXCEL</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Search bar & Sortir */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="relative w-full sm:w-64">
                          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                          <input
                            value={monthlySearch}
                            onChange={(e) => setMonthlySearch(e.target.value)}
                            placeholder="Cari part number, nama, spec..."
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white text-slate-800 focus:border-teal-500 dark:focus:border-[#f4c430] pl-8 pr-3 text-xs outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            <ArrowUpDown size={12} className="text-amber-500" /> Sortir:
                          </span>
                          <select
                            value={monthlySortField}
                            onChange={(e) => setMonthlySortField(e.target.value as MonthlySortField)}
                            className="h-9 rounded-lg border border-slate-200 bg-white text-slate-800 px-2.5 text-xs font-semibold outline-none focus:border-teal-500 dark:focus:border-[#f4c430]"
                          >
                            <option value="id">Kode Part</option>
                            <option value="part">Nama Part</option>
                            <option value="line">Line</option>
                            <option value="finalSisa">Sisa Stok Akhir</option>
                            <option value="currentStock">⚡ Stok Terkini</option>
                            <option value="totalIn">Total Masuk (IN)</option>
                            <option value="totalOut">Total Keluar (OUT)</option>
                            <option value="stokAwal">Stok Awal Bulan</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setMonthlySortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                            className="h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition active:scale-95"
                            title={monthlySortDir === 'asc' ? 'Urutan: Naik (Asc)' : 'Urutan: Turun (Desc)'}
                          >
                            {monthlySortDir === 'asc' ? '↑ Naik' : '↓ Turun'}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span>
                          Menampilkan <strong className="text-slate-800">{filteredMonthlyParts.length}</strong> dari{' '}
                          <strong className="text-slate-800">{parts.length}</strong> part
                        </span>
                        {(monthlyItemFilter !== 'ALL' || monthlyLineFilter !== 'All lines' || monthlySearch) && (
                          <button
                            type="button"
                            onClick={() => {
                              setMonthlyItemFilter('ALL')
                              setMonthlyLineFilter('All lines')
                              setMonthlySearch('')
                            }}
                            className="text-amber-500 hover:underline font-bold text-xs"
                          >
                            Reset Filter
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Monthly Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="rounded-xl border p-3.5 shadow-xs bg-white border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Material</p>
                      <p className="text-lg sm:text-xl font-black mt-0.5 text-slate-800">
                        {monthlyTotals.totalParts} Item
                      </p>
                    </div>
                    <div className="rounded-xl border p-3.5 shadow-xs bg-emerald-50/50 border-emerald-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Total Masuk (IN)</p>
                      <p className="text-lg sm:text-xl font-black text-emerald-500 mt-0.5">+{formatNumber(monthlyTotals.totalIn)} pcs</p>
                    </div>
                    <div className="rounded-xl border p-3.5 shadow-xs bg-rose-50/50 border-rose-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Total Keluar (OUT)</p>
                      <p className="text-lg sm:text-xl font-black text-rose-500 mt-0.5">-{formatNumber(monthlyTotals.totalOut)} pcs</p>
                    </div>
                    <div className="rounded-xl border p-3.5 shadow-xs bg-blue-50/50 border-blue-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Saldo Akhir Bulan</p>
                      <p className="text-lg sm:text-xl font-black text-blue-400 mt-0.5">{formatNumber(monthlyTotals.totalFinalStock)} pcs</p>
                    </div>
                  </div>

                  {/* Hint Scroll Banner */}
                  <div className="border px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs mb-3 bg-[#e0f7fa] border-[#80deea] text-[#006064]">
                    <ArrowLeftRight size={14} className="shrink-0 text-[#00838f]" />
                    <span>
                      Geser tabel ke kanan atau kiri untuk melihat seluruh tanggal (01 s/d {monthMeta.daysCount} {monthMeta.labelIndo}).
                    </span>
                  </div>
                </div>
              )}

              {/* Main Content Area */}
              {stockMovementView === 'matrix' ? (
                /* ── MONTHLY MATRIX TABLE (IN / OUT / SISA only, AWAL is in front) ── */
                <div
                  className={`rounded-2xl border shadow-md overflow-hidden flex flex-col transition-colors ${
                    isTvFullscreen
                      ? theme === 'dark'
                        ? 'border-slate-700 bg-slate-950 flex-1 min-h-0'
                        : 'border-slate-300 bg-white flex-1 min-h-0'
                      : 'border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div className={`${isTvFullscreen ? 'flex-1 min-h-0 overflow-auto' : 'overflow-x-auto'}`}>
                    <table className="w-full text-left border-collapse text-xs">
                      {/* Dark table header */}
                      <thead className="sticky top-0 z-30">
                        <tr className="bg-[#17202b] text-white border-b border-slate-700 text-[11px] font-bold">
                          {/* Sticky Item / Data Header */}
                          <th
                            onClick={() => {
                              if (monthlySortField === 'part') {
                                setMonthlySortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                              } else {
                                setMonthlySortField('part')
                                setMonthlySortDir('asc')
                              }
                            }}
                            className="sticky left-0 top-0 z-40 bg-[#17202b] px-4 py-3.5 min-w-[210px] sm:min-w-[230px] border-r border-slate-700 shadow-[2px_0_6px_rgba(0,0,0,0.25)] cursor-pointer select-none hover:bg-slate-800 transition"
                            title="Klik untuk sortir berdasarkan Nama Part"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="tracking-wider uppercase text-slate-200">ITEM / DATA</span>
                              <span className="flex items-center text-xs">
                                {monthlySortField === 'part' || monthlySortField === 'id' ? (
                                  <span className="text-amber-400 font-extrabold">{monthlySortDir === 'asc' ? '▲' : '▼'}</span>
                                ) : (
                                  <ArrowUpDown size={12} className="text-slate-500 opacity-60" />
                                )}
                              </span>
                            </div>
                          </th>

                          {/* Day Columns 01..31 */}
                          {monthMeta.daysList.map((dayNum) => {
                            const dayDate = new Date(monthMeta.year, monthMeta.month - 1, dayNum)
                            const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6
                            const dayStr = `${selectedMonth}-${String(dayNum).padStart(2, '0')}`
                            const isToday = dayStr === getLocalDateString()

                            return (
                              <th
                                key={dayNum}
                                className={`sticky top-0 z-30 px-2 py-3 text-center min-w-[58px] border-r border-slate-700/60 transition ${
                                  isToday
                                    ? theme === 'light'
                                      ? 'bg-teal-900/60 text-teal-200 border-t-2 border-t-teal-400'
                                      : 'bg-amber-950/80 text-[#f4c430] border-t-2 border-t-[#f4c430]'
                                    : isWeekend
                                    ? 'bg-slate-800 text-slate-400'
                                    : 'bg-[#17202b] text-slate-200'
                                }`}
                              >
                                <div className={`font-mono ${isTvFullscreen ? 'text-[13px] font-black' : 'text-[12px] font-bold'}`}>
                                  {String(dayNum).padStart(2, '0')}
                                </div>
                                <div className="text-[9px] font-normal text-slate-400 lowercase">
                                  {dayDate.toLocaleDateString('id-ID', { weekday: 'short' })}
                                </div>
                              </th>
                            )
                          })}

                          {/* Summary Columns */}
                          <th
                            onClick={() => {
                              if (monthlySortField === 'totalIn') {
                                setMonthlySortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                              } else {
                                setMonthlySortField('totalIn')
                                setMonthlySortDir('desc')
                              }
                            }}
                            className="sticky top-0 z-30 px-3 py-3 text-right min-w-[75px] bg-[#17202b] text-emerald-400 border-l border-slate-700 font-bold cursor-pointer select-none hover:bg-slate-800 transition"
                            title="Klik untuk sortir berdasarkan Total IN"
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>TOTAL IN</span>
                              {monthlySortField === 'totalIn' ? (
                                <span className="text-amber-400 font-extrabold">{monthlySortDir === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <ArrowUpDown size={11} className="text-slate-500 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            onClick={() => {
                              if (monthlySortField === 'totalOut') {
                                setMonthlySortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                              } else {
                                setMonthlySortField('totalOut')
                                setMonthlySortDir('desc')
                              }
                            }}
                            className="sticky top-0 z-30 px-3 py-3 text-right min-w-[75px] bg-[#17202b] text-rose-400 border-l border-slate-700 font-bold cursor-pointer select-none hover:bg-slate-800 transition"
                            title="Klik untuk sortir berdasarkan Total OUT"
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>TOTAL OUT</span>
                              {monthlySortField === 'totalOut' ? (
                                <span className="text-amber-400 font-extrabold">{monthlySortDir === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <ArrowUpDown size={11} className="text-slate-500 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            onClick={() => {
                              if (monthlySortField === 'finalSisa') {
                                setMonthlySortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                              } else {
                                setMonthlySortField('finalSisa')
                                setMonthlySortDir('asc')
                              }
                            }}
                            className="sticky top-0 z-30 px-3 py-3 text-right min-w-[85px] bg-[#17202b] text-blue-300 border-l border-slate-700 font-bold cursor-pointer select-none hover:bg-slate-800 transition"
                            title="Klik untuk sortir berdasarkan Sisa Akhir"
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>SISA AKHIR</span>
                              {monthlySortField === 'finalSisa' ? (
                                <span className="text-amber-400 font-extrabold">{monthlySortDir === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <ArrowUpDown size={11} className="text-slate-500 opacity-60" />
                              )}
                            </div>
                          </th>
                        </tr>
                      </thead>

                      {/* Table Body */}
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {monthlyMatrixData.length === 0 ? (
                          <tr>
                            <td
                              colSpan={monthMeta.daysCount + 4}
                              className="px-6 py-14 text-center text-slate-400"
                            >
                              <Boxes size={36} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                              <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Tidak ada item material yang sesuai.</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                Silakan sesuaikan filter atau tambahkan master part terlebih dahulu.
                              </p>
                              {parts.length === 0 && (
                                <button
                                  type="button"
                                  onClick={handleOpenPartForm}
                                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#202932] text-white font-bold text-xs hover:bg-[#2c3945]"
                                >
                                  <Plus size={14} /> Tambah Master Part
                                </button>
                              )}
                            </td>
                          </tr>
                        ) : (
                          monthlyMatrixData.map((item) => {
                            const liveCurrent = partStats[item.part.id]?.currentStock ?? item.part.opening
                            const isMinus = liveCurrent < 0

                            return (
                              <React.Fragment key={item.part.id}>
                                {/* ── Item Banner Row: FRONT INFORMATION with Opening Stock & Real-time Live Stock ── */}
                                <tr className="border-t-2 bg-slate-100/90 border-slate-300 text-slate-800 dark:bg-slate-800/90 dark:border-slate-700 dark:text-slate-100 transition-colors">
                                  <td className="sticky left-0 z-20 px-4 py-2.5 font-bold border-r shadow-[2px_0_6px_rgba(0,0,0,0.06)] bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-700">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2.5 py-0.5 rounded bg-[#e11d48] text-white font-mono font-extrabold text-xs shadow-xs tracking-wide">
                                        {item.part.id}
                                      </span>
                                      <span className="font-extrabold text-xs truncate max-w-[130px] text-slate-900 dark:text-slate-100" title={item.part.part}>
                                        {item.part.part}
                                      </span>
                                    </div>
                                  </td>
                                  <td
                                    colSpan={monthMeta.daysCount + 3}
                                    className="px-4 py-2 text-[11px] font-semibold bg-slate-100/80 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
                                  >
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                      {/* Line badge */}
                                      <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold border border-slate-300 dark:border-slate-700 text-[10px]">
                                        Line {item.part.line}
                                      </span>

                                      {/* 📦 STOK AWAL BULAN (Pindah ke depan) */}
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold shadow-2xs">
                                        <span className="text-slate-500 dark:text-slate-400 font-normal">Stok Awal:</span>
                                        <strong className="font-mono text-slate-900 dark:text-slate-100">{formatNumber(item.daily[0]?.awal ?? item.priorStock)}</strong>
                                        <span className="text-[10px] text-slate-400">pcs</span>
                                      </span>

                                      {/* 📥 TOTAL IN BULAN INI */}
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-bold">
                                        <span className="text-emerald-700/80 dark:text-emerald-400/80 font-normal text-[10px]">In:</span>
                                        <strong className="font-mono">+{formatNumber(item.totalIn)}</strong>
                                      </span>

                                      {/* 📤 TOTAL OUT BULAN INI */}
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100/90 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-300 font-bold">
                                        <span className="text-rose-700/80 dark:text-rose-400/80 font-normal text-[10px]">Out:</span>
                                        <strong className="font-mono">-{formatNumber(item.totalOut)}</strong>
                                      </span>

                                      {/* ⚡ STOK TERKINI (LIVE UPDATE REALTIME) */}
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg border font-extrabold shadow-xs transition-all ${
                                          isMinus
                                            ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                                            : 'bg-blue-600 text-white border-blue-700'
                                        }`}
                                        title="Stok saat ini (otomatis update seketika ada mutasi masuk/keluar)"
                                      >
                                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-90">⚡ Stok Terkini:</span>
                                        <span className="font-mono text-xs">{formatNumber(liveCurrent)} pcs</span>
                                      </span>

                                      <span className="hidden lg:inline text-slate-400">&middot;</span>
                                      <span className="hidden lg:inline text-slate-600 dark:text-slate-400">
                                        Coil: <strong className="text-slate-800 dark:text-slate-200">{item.part.coil}</strong> &middot; Spec: <strong className="text-slate-800 dark:text-slate-200">{item.part.spec}</strong>
                                      </span>
                                    </div>
                                  </td>
                                </tr>

                                {/* ── Sub-row 1: IN (Barang Masuk) ── */}
                                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors bg-emerald-50/15 dark:bg-emerald-950/20">
                                  <td className="sticky left-0 z-20 px-4 py-2 text-center font-extrabold text-[11px] uppercase tracking-wider border-r shadow-[2px_0_6px_rgba(0,0,0,0.04)] bg-emerald-50/90 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-400 border-slate-200 dark:border-slate-800">
                                    IN
                                  </td>
                                  {item.daily.map((d) => (
                                    <td
                                      key={d.dayNum}
                                      className={`px-2 py-2 text-center font-mono text-xs border-r ${
                                        d.isToday
                                          ? d.inQty > 0
                                            ? 'font-bold text-emerald-900 dark:text-emerald-200 bg-amber-200/80 dark:bg-amber-900/60 border-amber-400 dark:border-amber-600 ring-1 ring-inset ring-amber-300'
                                            : 'text-slate-600 dark:text-slate-300 bg-amber-100/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                                          : d.inQty > 0
                                          ? 'font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/30 border-slate-100 dark:border-slate-800'
                                          : 'text-slate-400 dark:text-slate-600 border-slate-100 dark:border-slate-800/60'
                                      }`}
                                    >
                                      {d.inQty > 0 ? formatNumber(d.inQty) : 0}
                                    </td>
                                  ))}
                                  <td className="px-3 py-2 text-right font-mono font-bold text-xs border-l border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                    +{formatNumber(item.totalIn)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-xs border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600">
                                    —
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-xs border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600">
                                    —
                                  </td>
                                </tr>

                                {/* ── Sub-row 2: OUT (Barang Keluar) ── */}
                                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors bg-rose-50/15 dark:bg-rose-950/20">
                                  <td className="sticky left-0 z-20 px-4 py-2 text-center font-extrabold text-[11px] uppercase tracking-wider border-r shadow-[2px_0_6px_rgba(0,0,0,0.04)] bg-rose-50/90 dark:bg-rose-950/90 text-rose-700 dark:text-rose-400 border-slate-200 dark:border-slate-800">
                                    OUT
                                  </td>
                                  {item.daily.map((d) => (
                                    <td
                                      key={d.dayNum}
                                      className={`px-2 py-2 text-center font-mono text-xs border-r ${
                                        d.isToday
                                          ? d.outQty > 0
                                            ? 'font-bold text-rose-900 dark:text-rose-200 bg-amber-200/80 dark:bg-amber-900/60 border-amber-400 dark:border-amber-600 ring-1 ring-inset ring-amber-300'
                                            : 'text-slate-600 dark:text-slate-300 bg-amber-100/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                                          : d.outQty > 0
                                          ? 'font-bold text-rose-700 dark:text-rose-400 bg-rose-100/50 dark:bg-rose-900/30 border-slate-100 dark:border-slate-800'
                                          : 'text-slate-400 dark:text-slate-600 border-slate-100 dark:border-slate-800/60'
                                      }`}
                                    >
                                      {d.outQty > 0 ? formatNumber(d.outQty) : 0}
                                    </td>
                                  ))}
                                  <td className="px-3 py-2 text-right font-mono text-xs border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600">
                                    —
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-bold text-xs border-l border-slate-200 dark:border-slate-800 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                                    -{formatNumber(item.totalOut)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-xs border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600">
                                    —
                                  </td>
                                </tr>

                                {/* ── Sub-row 3: SISA (BOLD BLUE AS IN SCREENSHOT) ── */}
                                <tr className="hover:bg-blue-50/30 dark:hover:bg-blue-950/30 transition-colors bg-blue-50/10 dark:bg-blue-950/15 border-b-2 border-slate-300 dark:border-slate-700">
                                  <td className="sticky left-0 z-20 px-4 py-2 text-center font-extrabold text-[11px] uppercase tracking-wider border-r shadow-[2px_0_6px_rgba(0,0,0,0.04)] bg-blue-50/90 dark:bg-blue-950/90 text-[#2563eb] dark:text-blue-400 border-slate-200 dark:border-slate-800">
                                    SISA
                                  </td>
                                  {item.daily.map((d) => (
                                    <td
                                      key={d.dayNum}
                                      className={`px-2 py-2 text-center font-mono font-bold text-xs border-r ${
                                        d.isToday
                                          ? d.sisa < 0
                                            ? 'text-rose-700 dark:text-rose-300 bg-amber-300/80 dark:bg-amber-900/80 border-amber-500 dark:border-amber-600 ring-1 ring-inset ring-amber-400'
                                            : 'text-amber-900 dark:text-amber-200 bg-amber-300/90 dark:bg-amber-900/80 border-amber-500 dark:border-amber-600 ring-1 ring-inset ring-amber-400'
                                          : d.sisa < 0
                                          ? 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/50 border-slate-100 dark:border-slate-800'
                                          : 'text-[#2563eb] dark:text-blue-400 border-slate-100 dark:border-slate-800/60'
                                      }`}
                                    >
                                      {formatNumber(d.sisa)}
                                    </td>
                                  ))}
                                  <td className="px-3 py-2 text-right font-mono text-xs border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600">
                                    —
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-xs border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600">
                                    —
                                  </td>
                                  <td className={`px-3 py-2 text-right font-mono font-extrabold text-xs border-l border-slate-200 dark:border-slate-800 ${
                                    item.finalSisa < 0
                                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                      : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                  }`}>
                                    {formatNumber(item.finalSisa)}
                                  </td>
                                </tr>
                              </React.Fragment>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* ── LIST VIEW (Daftar Transaksi Mutasi) ── */
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Cari transaksi atau part..."
                          className="w-64 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-[#eab308]"
                        />
                      </div>
                      <select
                        value={lineFilter}
                        onChange={(e) => setLineFilter(e.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 outline-none"
                      >
                        <option value="All lines">Semua Line</option>
                        {availableLines.map((l) => (
                          <option key={l} value={l}>
                            Line {l}
                          </option>
                        ))}
                      </select>

                      <select
                        value={movementTypeFilter}
                        onChange={(e) => setMovementTypeFilter(e.target.value as 'ALL' | 'IN' | 'OUT')}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 outline-none"
                      >
                        <option value="ALL">Semua Tipe (IN & OUT)</option>
                        <option value="IN">🟢 Barang Masuk (IN)</option>
                        <option value="OUT">🔴 Barang Keluar (OUT)</option>
                      </select>
                    </div>
                    <span className="text-xs text-slate-400">Total: {visibleMovements.length} transaksi</span>
                  </div>
                  <MovementTable
                    movements={visibleMovements}
                    parts={parts}
                    onDelete={handleDeleteMovement}
                    onAddNew={handleOpenMovementForm}
                    onEdit={handleEditMovement}
                  />
                </div>
              )}
            </div>
          )}

          {/* MASTER PART PAGE */}
          {activePage === 'Master Part' && (
            <div className="tab-fade-in">
              <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="mb-1 text-sm text-slate-500">Database spesifikasi & stok awal material</p>
                  <h2 className="text-2xl font-bold">Master Part</h2>
                </div>
                <button
                  onClick={handleOpenPartForm}
                  className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
                  style={{ backgroundColor: 'var(--sf-sidebar-bg)' }}
                >
                  <Plus size={16} /> Tambah Part Baru
                </button>
              </div>

              <div className="rounded-xl border shadow-sm transition-colors" style={{ backgroundColor: 'var(--sf-card-bg)', borderColor: 'var(--sf-header-border)' }}>
                <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center" style={{ borderColor: 'var(--sf-header-border)' }}>
                  <div>
                    <h3 className="font-bold">Daftar Barang Terdaftar</h3>
                    <p className="mt-1 text-xs text-slate-400">{parts.length} part aktif dalam sistem</p>
                  </div>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Cari kode/part/spec..."
                      className="w-56 rounded-lg border py-2 pl-9 pr-3 text-xs outline-none transition-colors"
                      style={{ borderColor: 'var(--sf-header-border)', backgroundColor: 'var(--sf-card-bg)', color: 'var(--foreground)' }}
                    />
                  </div>
                </div>
                <PartTable
                  parts={parts.filter(
                    (p) =>
                      !query ||
                      `${p.id} ${p.coil} ${p.part} ${p.spec} ${p.line}`.toLowerCase().includes(query.toLowerCase())
                  )}
                  partStats={partStats}
                  onDelete={handleDeletePart}
                  onAddNew={handleOpenPartForm}
                />
              </div>
            </div>
          )}

          {/* REPORT PAGE */}
          {activePage === 'Report' && (
            <div className="tab-fade-in">
              <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="mb-1 text-sm text-slate-500">Laporan akumulasi mutasi dan saldo akhir</p>
                  <h2 className="text-2xl font-bold">Stock Report</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold shadow-sm transition active:scale-95"
                    style={{ backgroundColor: 'var(--sf-card-bg)', borderColor: 'var(--sf-header-border)', color: 'var(--foreground)' }}
                  >
                    <Download size={15} /> Export CSV / Excel
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="Total Stok Awal"
                  value={formatNumber(totals.openingTotal)}
                  detail="Saldo awal master part"
                  icon={Warehouse}
                  tone="blue"
                />
                <StatCard
                  label="Total Pergerakan"
                  value={formatNumber(totals.inTotal + totals.outTotal)}
                  detail={`${formatNumber(totals.inTotal)} IN / ${formatNumber(totals.outTotal)} OUT`}
                  icon={BarChart3}
                  tone="yellow"
                />
                <StatCard
                  label="Saldo Akhir Stok"
                  value={formatNumber(totals.current)}
                  detail="Total stok fisik saat ini"
                  icon={PackageCheck}
                  tone="green"
                />
              </div>

              <div className="mt-6 rounded-xl border p-6 shadow-sm transition-colors" style={{ backgroundColor: 'var(--sf-card-bg)', borderColor: 'var(--sf-header-border)' }}>
                <h3 className="font-bold">Laporan Saldo per Part</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Perhitungan stok awal, total penerimaan (IN), pengeluaran (OUT), dan saldo akhir
                </p>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead className="border-b text-[10px] uppercase tracking-wider text-slate-400" style={{ borderColor: 'var(--sf-header-border)' }}>
                      <tr>
                        <th className="py-3 px-3">FII ID</th>
                        <th className="py-3 px-3">PART NUMBER</th>
                        <th className="py-3 px-3">Line</th>
                        <th className="py-3 px-3 text-right">Stok Awal</th>
                        <th className="py-3 px-3 text-right">Total Masuk (IN)</th>
                        <th className="py-3 px-3 text-right">Total Keluar (OUT)</th>
                        <th className="py-3 px-3 text-right">Saldo Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                            Belum ada master part yang terdaftar.
                          </td>
                        </tr>
                      ) : (
                        parts.map((p) => {
                          const stats = partStats[p.id] || { inQty: 0, outQty: 0, currentStock: p.opening }
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                              <td className="py-4 px-3 font-bold text-slate-800 dark:text-slate-100">{p.id}</td>
                              <td className="py-4 px-3 text-slate-600 dark:text-slate-300">{p.part}</td>
                              <td className="py-4 px-3 font-semibold text-slate-800 dark:text-slate-200">{p.line}</td>
                              <td className="py-4 px-3 text-right text-slate-500 dark:text-slate-400">{formatNumber(p.opening)}</td>
                              <td className="py-4 px-3 text-right font-semibold text-[#29934b] dark:text-emerald-400">
                                {stats.inQty > 0 ? `+${formatNumber(stats.inQty)}` : '0'}
                              </td>
                              <td className="py-4 px-3 text-right font-semibold text-[#c75a42] dark:text-rose-400">
                                {stats.outQty > 0 ? `-${formatNumber(stats.outQty)}` : '0'}
                              </td>
                              <td className="py-4 px-3 text-right font-bold text-slate-800 dark:text-slate-100">
                                {formatNumber(stats.currentStock)}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* RIWAYAT PAGE */}
          {activePage === 'Riwayat' && (
            <div className={`riwayat-fade-in ${theme === 'light' ? 'light-riwayat' : ''}`} style={{ minHeight: '80vh' }}>
              {/* Page Hero Header */}
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl shadow-xs"
                      style={{
                        background:
                          theme === 'light'
                            ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'
                            : 'linear-gradient(135deg, #f4c430 0%, #d4a017 100%)',
                      }}
                    >
                      <History size={18} className={theme === 'light' ? 'text-white' : 'text-[#202932]'} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Stockflow / Riwayat</p>
                      <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Riwayat Transaksi</h2>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 pl-11">Log lengkap semua pergerakan stok masuk dan keluar</p>
                </div>
                <div className="flex items-center gap-2 pl-11 sm:pl-0">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      background: theme === 'light' ? 'rgba(13,148,136,0.1)' : 'rgba(244,196,48,0.1)',
                      color: theme === 'light' ? '#0d9488' : '#f4c430',
                      border: theme === 'light' ? '1px solid rgba(13,148,136,0.2)' : '1px solid rgba(244,196,48,0.2)',
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full animate-pulse"
                      style={{ background: theme === 'light' ? '#0d9488' : '#f4c430' }}
                    />
                    {riwayatFiltered.length} transaksi ditemukan
                  </span>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {/* Total Transaksi */}
                <div
                  className={`rounded-2xl p-5 ${theme === 'light' ? 'stat-glow-teal bg-white border border-teal-100 shadow-sm' : 'stat-glow-yellow'}`}
                  style={theme === 'dark' ? { background: 'linear-gradient(135deg, #202932 0%, #263240 100%)', border: '1px solid rgba(244,196,48,0.15)' } : {}}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold mb-3 text-slate-400 dark:text-white/40">TOTAL TRANSAKSI</p>
                      <p className="text-3xl font-bold" style={{ color: theme === 'light' ? '#0d9488' : '#f4c430' }}>
                        {formatNumber(riwayatFiltered.length)}
                      </p>
                      <p className="text-[11px] mt-1 text-slate-400 dark:text-white/30">dalam rentang tanggal dipilih</p>
                    </div>
                    <div
                      className="rounded-xl p-2.5"
                      style={{ background: theme === 'light' ? 'rgba(13,148,136,0.1)' : 'rgba(244,196,48,0.1)' }}
                    >
                      <History size={20} style={{ color: theme === 'light' ? '#0d9488' : '#f4c430' }} />
                    </div>
                  </div>
                </div>
                {/* Transaksi Masuk */}
                <div
                  className={`rounded-2xl p-5 ${theme === 'light' ? 'bg-white border border-emerald-100 shadow-sm' : 'stat-glow-green'}`}
                  style={theme === 'dark' ? { background: 'linear-gradient(135deg, #1a2920 0%, #1e3125 100%)', border: '1px solid rgba(74,222,128,0.12)' } : {}}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold mb-3 text-slate-400 dark:text-white/40">BARANG MASUK (IN)</p>
                      <p className="text-3xl font-bold text-emerald-600 dark:text-[#4ade80]">
                        {formatNumber(riwayatFiltered.filter(m => m.type === 'IN').reduce((s, m) => s + m.qty, 0))}
                      </p>
                      <p className="text-[11px] mt-1 text-slate-400 dark:text-white/30">
                        {riwayatFiltered.filter(m => m.type === 'IN').length} transaksi masuk
                      </p>
                    </div>
                    <div className="rounded-xl p-2.5 bg-emerald-500/10">
                      <ArrowDownToLine size={20} className="text-emerald-600 dark:text-[#4ade80]" />
                    </div>
                  </div>
                </div>
                {/* Transaksi Keluar */}
                <div
                  className={`rounded-2xl p-5 ${theme === 'light' ? 'bg-white border border-rose-100 shadow-sm' : 'stat-glow-blue'}`}
                  style={theme === 'dark' ? { background: 'linear-gradient(135deg, #201a1a 0%, #291e1e 100%)', border: '1px solid rgba(248,113,113,0.12)' } : {}}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold mb-3 text-slate-400 dark:text-white/40">BARANG KELUAR (OUT)</p>
                      <p className="text-3xl font-bold text-rose-600 dark:text-[#f87171]">
                        {formatNumber(riwayatFiltered.filter(m => m.type === 'OUT').reduce((s, m) => s + m.qty, 0))}
                      </p>
                      <p className="text-[11px] mt-1 text-slate-400 dark:text-white/30">
                        {riwayatFiltered.filter(m => m.type === 'OUT').length} transaksi keluar
                      </p>
                    </div>
                    <div className="rounded-xl p-2.5 bg-rose-500/10">
                      <ArrowUpFromLine size={20} className="text-rose-600 dark:text-[#f87171]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Card */}
              <div
                className="rounded-2xl overflow-hidden transition-colors"
                style={
                  theme === 'light'
                    ? { background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }
                    : { background: '#202932', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 8px 32px rgba(0,0,0,0.24)' }
                }
              >
                {/* Filter Bar */}
                <div
                  className="p-5 transition-colors"
                  style={
                    theme === 'light'
                      ? { borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }
                      : { borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }
                  }
                >
                  {/* Tablet Quick Range Chips */}
                  <div
                    className="mb-3.5 flex flex-wrap items-center gap-1.5 pb-3"
                    style={{
                      borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest mr-1 text-slate-500 dark:text-white/40">
                      Rentang Cepat:
                    </span>
                    {[
                      {
                        label: 'Hari Ini',
                        getDates: () => {
                          const today = new Date().toISOString().split('T')[0]
                          return { from: today, to: today }
                        },
                      },
                      {
                        label: 'Kemarin',
                        getDates: () => {
                          const d = new Date()
                          d.setDate(d.getDate() - 1)
                          const yest = d.toISOString().split('T')[0]
                          return { from: yest, to: yest }
                        },
                      },
                      {
                        label: '7 Hari Terakhir',
                        getDates: () => {
                          const to = new Date().toISOString().split('T')[0]
                          const d = new Date()
                          d.setDate(d.getDate() - 7)
                          const from = d.toISOString().split('T')[0]
                          return { from, to }
                        },
                      },
                      {
                        label: 'Bulan Ini',
                        getDates: () => {
                          const to = new Date().toISOString().split('T')[0]
                          const d = new Date()
                          d.setDate(1)
                          const from = d.toISOString().split('T')[0]
                          return { from, to }
                        },
                      },
                      {
                        label: 'Semua Data',
                        getDates: () => ({ from: '', to: '' }),
                      },
                    ].map((preset) => {
                      const dates = preset.getDates()
                      const isActive = riwayatFromDate === dates.from && riwayatToDate === dates.to
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setRiwayatFromDate(dates.from)
                            setRiwayatToDate(dates.to)
                            setRiwayatPage(1)
                          }}
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold transition active:scale-95 ${
                            isActive
                              ? theme === 'light'
                                ? 'bg-teal-600 text-white shadow-sm'
                                : 'bg-[#f4c430] text-[#202932] shadow-sm'
                              : theme === 'light'
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'
                          }`}
                        >
                          {preset.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    {/* Dari Tanggal */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/35">
                        Dari Tanggal
                      </label>
                      <div className="relative">
                        <Calendar size={13} className="absolute left-3 top-2.5 text-slate-400 dark:text-white/30" />
                        <input
                          id="riwayat-from-date"
                          type="date"
                          value={riwayatFromDate}
                          onChange={(e) => setRiwayatFromDate(e.target.value)}
                          className="riwayat-filter-input rounded-xl pl-8 pr-3 py-2 text-xs"
                        />
                      </div>
                    </div>

                    {/* Sampai Tanggal */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/35">
                        Sampai Tanggal
                      </label>
                      <div className="relative">
                        <Calendar size={13} className="absolute left-3 top-2.5 text-slate-400 dark:text-white/30" />
                        <input
                          id="riwayat-to-date"
                          type="date"
                          value={riwayatToDate}
                          onChange={(e) => setRiwayatToDate(e.target.value)}
                          className="riwayat-filter-input rounded-xl pl-8 pr-3 py-2 text-xs"
                        />
                      </div>
                    </div>

                    {/* Part Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/35">
                        Item / Part
                      </label>
                      <select
                        id="riwayat-part-filter"
                        value={riwayatPartFilter}
                        onChange={(e) => { setRiwayatPartFilter(e.target.value); setRiwayatPage(1) }}
                        className="riwayat-filter-input rounded-xl px-3 py-2 text-xs min-w-[180px] cursor-pointer"
                      >
                        <option value="ALL">SEMUA ITEM</option>
                        {parts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.id} — {p.part}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Filter Tipe IN / OUT */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/35">
                        Tipe
                      </label>
                      <div
                        className="flex items-center gap-1 rounded-xl p-1"
                        style={
                          theme === 'light'
                            ? { background: '#f1f5f9', border: '1px solid #cbd5e1' }
                            : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }
                        }
                      >
                        <button
                          type="button"
                          onClick={() => { setRiwayatTypeFilter('ALL'); setRiwayatPage(1) }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                            riwayatTypeFilter === 'ALL'
                              ? theme === 'light'
                                ? 'bg-teal-600 text-white shadow-sm'
                                : 'bg-[#f4c430] text-[#202932] shadow-sm'
                              : theme === 'light'
                              ? 'text-slate-600 hover:text-slate-900'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Semua
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRiwayatTypeFilter('IN'); setRiwayatPage(1) }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                            riwayatTypeFilter === 'IN'
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          <ArrowDownToLine size={12} /> IN
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRiwayatTypeFilter('OUT'); setRiwayatPage(1) }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                            riwayatTypeFilter === 'OUT'
                              ? 'bg-rose-500 text-white shadow-sm'
                              : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                          }`}
                        >
                          <ArrowUpFromLine size={12} /> OUT
                        </button>
                      </div>
                    </div>

                    {/* Search */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/35">
                        Cari
                      </label>
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-2.5 text-slate-400 dark:text-white/30" />
                        <input
                          id="riwayat-search"
                          type="text"
                          value={riwayatSearch}
                          onChange={(e) => { setRiwayatSearch(e.target.value); setRiwayatPage(1) }}
                          placeholder="Cari ID, part, catatan..."
                          className="riwayat-filter-input rounded-xl pl-8 pr-3 py-2 text-xs w-full"
                        />
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 pb-0">
                      <button
                        id="riwayat-search-btn"
                        onClick={handleRiwayatSearch}
                        className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition active:scale-95"
                        style={
                          theme === 'light'
                            ? { background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', color: '#ffffff' }
                            : { background: 'linear-gradient(135deg, #f4c430 0%, #d4a017 100%)', color: '#202932' }
                        }
                      >
                        <Search size={13} />
                        Cari
                      </button>
                      <button
                        id="riwayat-reset-btn"
                        onClick={handleRiwayatReset}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition active:scale-95"
                        style={
                          theme === 'light'
                            ? { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' }
                            : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }
                        }
                      >
                        <RotateCcw size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Table or Empty */}
                {riwayatFiltered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div
                      className="rounded-2xl p-5"
                      style={{ background: theme === 'light' ? '#f0fdfa' : 'rgba(255,255,255,0.04)' }}
                    >
                      <History size={36} style={{ color: theme === 'light' ? '#0d9488' : 'rgba(255,255,255,0.15)' }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-600 dark:text-white/40">Tidak ada transaksi ditemukan</p>
                      <p className="text-xs mt-1 text-slate-400 dark:text-white/20">Coba ubah filter tanggal atau pilih item yang berbeda</p>
                    </div>
                    <button
                      onClick={handleRiwayatReset}
                      className="text-xs font-bold px-4 py-2 rounded-xl transition"
                      style={
                        theme === 'light'
                          ? { color: '#0d9488', background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)' }
                          : { color: '#f4c430', background: 'rgba(244,196,48,0.08)', border: '1px solid rgba(244,196,48,0.15)' }
                      }
                    >
                      Reset Filter
                    </button>
                  </div>
                ) : (
                  <>
                    <RiwayatTable
                      movements={riwayatPagedData}
                      parts={parts}
                      onDelete={handleDeleteMovement}
                      onEdit={handleEditMovement}
                      currentUser="Operator"
                    />

                    {/* Pagination */}
                    {riwayatTotalPages > 1 && (
                      <div
                        className="flex items-center justify-between px-5 py-4"
                        style={{
                          borderTop: theme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <p className="text-xs text-slate-500 dark:text-white/30">
                          Halaman <span className="font-semibold text-slate-800 dark:text-white/60">{riwayatPage}</span> dari <span className="font-semibold text-slate-800 dark:text-white/60">{riwayatTotalPages}</span>
                          &nbsp;&middot;&nbsp;{riwayatFiltered.length} total transaksi
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            id="riwayat-prev-page"
                            onClick={() => setRiwayatPage(p => Math.max(1, p - 1))}
                            disabled={riwayatPage === 1}
                            className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:opacity-30 active:scale-95"
                            style={
                              theme === 'light'
                                ? { background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1' }
                                : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }
                            }
                          >
                            <ChevronLeft size={13} /> Prev
                          </button>
                          {Array.from({ length: Math.min(5, riwayatTotalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(riwayatPage - 2, riwayatTotalPages - 4))
                            const page = start + i
                            return page <= riwayatTotalPages ? (
                              <button
                                key={page}
                                onClick={() => setRiwayatPage(page)}
                                className="w-8 h-8 rounded-xl text-xs font-bold transition active:scale-95"
                                style={
                                  page === riwayatPage
                                    ? theme === 'light'
                                      ? { background: '#0d9488', color: '#ffffff' }
                                      : { background: '#f4c430', color: '#202932' }
                                    : theme === 'light'
                                    ? { background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }
                                    : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }
                                }
                              >
                                {page}
                              </button>
                            ) : null
                          })}
                          <button
                            id="riwayat-next-page"
                            onClick={() => setRiwayatPage(p => Math.min(riwayatTotalPages, p + 1))}
                            disabled={riwayatPage === riwayatTotalPages}
                            className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:opacity-30 active:scale-95"
                            style={
                              theme === 'light'
                                ? { background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1' }
                                : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }
                            }
                          >
                            Next <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* FLOATING ACTION BUTTON (FAB) - Mempermudah Input di Tablet & Mobile */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={handleOpenMovementForm}
          title="Input Pergerakan Cepat"
          className="flex items-center gap-2.5 rounded-2xl px-4 py-3.5 text-xs sm:text-sm font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all duration-150 border"
          style={
            theme === 'light'
              ? {
                  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                  color: '#ffffff',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 10px 25px -4px rgba(13, 148, 136, 0.45), 0 6px 12px -3px rgba(0, 0, 0, 0.25)',
                }
              : {
                  background: 'linear-gradient(135deg, #f4c430 0%, #d4a017 100%)',
                  color: '#202932',
                  borderColor: 'rgba(244, 196, 48, 0.4)',
                  boxShadow: '0 10px 25px -4px rgba(244, 196, 48, 0.45), 0 6px 12px -3px rgba(0, 0, 0, 0.25)',
                }
          }
        >
          <div
            className="flex h-6 w-6 items-center justify-center rounded-lg"
            style={{
              background: theme === 'light' ? 'rgba(255,255,255,0.2)' : '#202932',
              color: '#ffffff',
            }}
          >
            <Plus size={15} className="stroke-[3]" />
          </div>
          <span className="font-extrabold tracking-wide">Input Mutasi</span>
        </button>
      </div>

      {/* MODAL INPUT PERGERAKAN (IN / OUT) */}
      {showMovementForm && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-[#17202b]/60 backdrop-blur-xs p-3 sm:p-4 pt-10 sm:pt-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col" style={{ maxHeight: 'calc(100dvh - 80px)' }}>
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#a17e00]">Form Mutasi Stok</p>
                <h2 className="mt-1 text-xl font-bold">
                  {editingMovementId ? 'Edit Transaksi Mutasi' : 'Input Pergerakan Barang'}
                </h2>
              </div>
              <button
                onClick={handleCloseMovementForm}
                aria-label="Close"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 transition"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4 p-5 overflow-y-auto flex-1">
              <div>
                <label className="block mb-1.5 text-xs font-bold text-slate-600">Pilih Master Part *</label>
                {parts.length === 0 ? (
                  <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
                    Belum ada master part!{' '}
                    <button
                      type="button"
                      onClick={() => {
                        handleCloseMovementForm()
                        handleOpenPartForm()
                      }}
                      className="underline font-bold"
                    >
                      Klik di sini untuk tambah part dahulu
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedPartId}
                    onChange={(e) => setSelectedPartId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#eab308]"
                  >
                    {parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} - {p.part} (Line {p.line})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* ── Tanggal & Waktu (PKIS-PLUS style: datetime-local) ── */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Calendar size={13} className="text-indigo-500" />
                    Tanggal &amp; Waktu Transaksi
                  </label>
                  {/* Quick-date shortcuts */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMovDatetime(toLocalInput(new Date().toISOString()))}
                      className="text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-lg border border-emerald-200 cursor-pointer active:scale-95 transition flex items-center gap-0.5"
                    >
                      ⚡ Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        d.setHours(0, 0, 0, 0)
                        setMovDatetime(toLocalInput(d.toISOString()))
                      }}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer active:scale-95 transition"
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        d.setDate(d.getDate() - 1)
                        d.setHours(0, 0, 0, 0)
                        setMovDatetime(toLocalInput(d.toISOString()))
                      }}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer active:scale-95 transition"
                    >
                      Kemarin
                    </button>
                  </div>
                </div>

                {/* Grid 2 Kolom: Tanggal & Waktu (Popup Time Picker) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                      Tanggal Transaksi
                    </label>
                    <input
                      type="date"
                      value={movDatePart}
                      onChange={(e) => handleSetDate(e.target.value)}
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-mono font-semibold outline-none focus:border-[#eab308]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                      Waktu Transaksi (Jam : Menit)
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenTimePicker}
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-mono font-bold flex items-center justify-between hover:border-[#00897b] hover:bg-teal-50/30 transition group cursor-pointer text-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-[#00897b] group-hover:scale-110 transition-transform" />
                        <span>{movTimePart || '00:00'}</span>
                        <span className="text-[10px] font-sans text-slate-400 font-normal">WIB</span>
                      </div>
                      <span className="text-[11px] font-sans font-bold text-[#00897b] bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md group-hover:bg-teal-100 transition">
                        Pilih Jam ▾
                      </span>
                    </button>
                  </div>
                </div>

                {/* Live formatted date preview */}
                <div className="text-[11px] text-slate-500 font-mono font-semibold text-right">
                  {fmt(movDatetime || null)}
                </div>
              </div>

              {/* ── Jumlah (Qty) ── */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600">Jumlah (Qty)</label>
                  <span className="text-[11px] font-mono font-semibold text-slate-500">
                    {formatNumber(Number(movQty) || 0)} pcs
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMovQty((prev) => String(Math.max(1, (Number(prev) || 0) - 10)))}
                    className="h-10 w-12 shrink-0 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 active:scale-95 transition text-sm"
                  >
                    −10
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={movQty}
                    onChange={(e) => setMovQty(e.target.value)}
                    className="flex-1 text-center font-bold text-base h-10 rounded-lg border border-slate-200 bg-white px-2 outline-none focus:border-[#eab308]"
                    placeholder="100"
                  />
                  <button
                    type="button"
                    onClick={() => setMovQty((prev) => String((Number(prev) || 0) + 10))}
                    className="h-10 w-12 shrink-0 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 active:scale-95 transition text-sm"
                  >
                    +10
                  </button>
                </div>
                {/* Quick preset chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[50, 100, 250, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMovQty(String(preset))}
                      className={`h-8 px-3 rounded-lg text-xs font-bold transition active:scale-95 ${
                        Number(movQty) === preset
                          ? 'bg-[#f4c430] text-[#202932] shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMovQty((prev) => String((Number(prev) || 0) + 100))}
                    className="h-8 px-3 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 active:scale-95 transition"
                  >
                    +100
                  </button>
                </div>
              </div>

              {/* ── Tipe Pergerakan ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600">Tipe Pergerakan</span>
                  {currentRole !== 'SUPERVISOR' && (
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 flex items-center gap-1">
                      <Lock size={10} /> Terkunci: {ROLES[currentRole].name}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={!ROLES[currentRole].allowedTypes.includes('IN')}
                    onClick={() => setMovType('IN')}
                    className={`rounded-xl border-2 px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 transition ${
                      movType === 'IN'
                        ? 'border-[#29934b] bg-[#eaf6ed] text-[#29934b] shadow-sm'
                        : !ROLES[currentRole].allowedTypes.includes('IN')
                        ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowDownToLine size={16} />
                    <span>MASUK (IN)</span>
                  </button>
                  <button
                    type="button"
                    disabled={!ROLES[currentRole].allowedTypes.includes('OUT')}
                    onClick={() => setMovType('OUT')}
                    className={`rounded-xl border-2 px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 transition ${
                      movType === 'OUT'
                        ? 'border-[#c75a42] bg-[#fff0eb] text-[#c75a42] shadow-sm'
                        : !ROLES[currentRole].allowedTypes.includes('OUT')
                        ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowUpFromLine size={16} />
                    <span>KELUAR (OUT)</span>
                  </button>
                </div>
                {currentRole === 'RECEIVING' && (
                  <p className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5 border border-emerald-100 flex items-center gap-1.5">
                    🟢 <strong>Operator Receiving</strong>: hanya input barang masuk (IN).
                  </p>
                )}
                {currentRole === 'PRODUCTION' && (
                  <p className="mt-2 text-[11px] text-rose-700 bg-rose-50 rounded-lg px-3 py-1.5 border border-rose-100 flex items-center gap-1.5">
                    🔴 <strong>Operator Produksi</strong>: hanya input pengeluaran barang (OUT).
                  </p>
                )}
              </div>

              {/* ── Keterangan / Catatan ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-600">Keterangan / Catatan</label>
                  <span className="text-[10px] text-slate-400">Tap preset atau ketik manual</span>
                </div>
                <input
                  type="text"
                  list="movNoteOptions"
                  value={movNote}
                  onChange={(e) => setMovNote(e.target.value)}
                  placeholder="Pilih preset di bawah atau ketik..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#eab308] mb-2"
                />
                <datalist id="movNoteOptions">
                  {movType === 'IN' ? (
                    <>
                      <option value="Input dari Supplier" />
                      <option value="Bongkar Kontainer" />
                      <option value="Retur Produksi" />
                      <option value="Koreksi Stok Fisik" />
                      <option value="Material Baru" />
                    </>
                  ) : (
                    <>
                      <option value="Pemakaian Line YHA" />
                      <option value="Pemakaian Line YHB" />
                      <option value="Supply Setting Dies" />
                      <option value="Scrap / Part Defect" />
                      <option value="Trial Produksi" />
                      <option value="Sample QC" />
                    </>
                  )}
                </datalist>
                <div className="flex flex-wrap gap-1.5">
                  {(movType === 'IN'
                    ? ['Input dari Supplier', 'Bongkar Kontainer', 'Retur Produksi', 'Koreksi Stok Fisik', 'Material Baru']
                    : ['Pemakaian Line YHA', 'Pemakaian Line YHB', 'Supply Setting Dies', 'Scrap / Part Defect', 'Trial Produksi', 'Sample QC']
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMovNote(preset)}
                      className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition active:scale-95 ${
                        movNote === preset
                          ? movType === 'IN'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                  {movNote && (
                    <button
                      type="button"
                      onClick={() => setMovNote('')}
                      className="h-7 px-2.5 rounded-lg text-[11px] text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition"
                    >
                      ✕ Hapus
                    </button>
                  )}
                </div>
              </div>

              {/* ── Live Stock Preview ── */}
              {selectedPartId && parts.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-slate-200">
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Stok Saat Ini</p>
                      <p className="mt-0.5 text-lg font-bold text-slate-700">
                        {formatNumber(partStats[selectedPartId]?.currentStock ?? 0)}
                        <span className="text-xs font-normal text-slate-400 ml-1">pcs</span>
                      </p>
                    </div>
                    <div className="px-4 py-3 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Estimasi Saldo Baru</p>
                      {(() => {
                        const cur = partStats[selectedPartId]?.currentStock ?? 0
                        const change = (movType === 'IN' ? 1 : -1) * (Number(movQty) || 0)
                        const next = cur + change
                        return (
                          <p className={`mt-0.5 text-lg font-bold ${next < 0 ? 'text-[#c75a42]' : 'text-[#29934b]'}`}>
                            {formatNumber(next)}
                            <span className="text-xs font-normal ml-1">{next < 0 ? '⚠ Minus' : 'pcs'}</span>
                          </p>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-100 px-5 py-4 bg-slate-50/60 shrink-0">
              <button
                type="button"
                onClick={handleCloseMovementForm}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={parts.length === 0}
                onClick={handleAddMovement}
                className="rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50 shadow-sm transition active:scale-95"
                style={{ backgroundColor: 'var(--sf-sidebar-bg)' }}
              >
                {editingMovementId ? '💾 Simpan Perubahan' : '💾 Simpan Transaksi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP ANALOG CLOCK TIME PICKER MODAL (MATERIAL DESIGN - TOUCH OPTIMIZED) */}
      {showTimePicker && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
          onClick={() => setShowTimePicker(false)}
        >
          <div
            className="w-full max-w-[540px] rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col sm:flex-row animate-in zoom-in-95 duration-150 border border-slate-100 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Sidebar: Teal Header Display */}
            <div className="bg-[#00897b] text-white p-5 sm:p-6 flex flex-row sm:flex-col items-center justify-between sm:justify-center sm:w-[150px] shrink-0">
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-teal-200/90 mb-1 sm:mb-5 hidden sm:block">
                WAKTU
              </div>

              {/* Huge Hour & Minute Digits */}
              <div className="flex sm:flex-col items-center">
                <button
                  type="button"
                  onClick={() => setClockMode('hours')}
                  className={`font-mono text-5xl sm:text-6xl font-black leading-none transition cursor-pointer p-1.5 rounded-xl ${
                    clockMode === 'hours'
                      ? 'text-white scale-105 drop-shadow-md'
                      : 'text-teal-200/70 hover:text-white'
                  }`}
                  title="Pilih Jam"
                >
                  {String(selectedH12).padStart(2, '0')}
                </button>
                <span className="font-mono text-4xl sm:text-5xl text-teal-200/60 my-0.5 mx-1.5 sm:mx-0 select-none">
                  :
                </span>
                <button
                  type="button"
                  onClick={() => setClockMode('minutes')}
                  className={`font-mono text-5xl sm:text-6xl font-black leading-none transition cursor-pointer p-1.5 rounded-xl ${
                    clockMode === 'minutes'
                      ? 'text-white scale-105 drop-shadow-md'
                      : 'text-teal-200/70 hover:text-white'
                  }`}
                  title="Pilih Menit"
                >
                  {String(selectedMin).padStart(2, '0')}
                </button>
              </div>

              {/* AM / PM Toggle */}
              <div className="flex sm:flex-col gap-2 sm:mt-6 sm:w-full">
                <button
                  type="button"
                  onClick={() => setPeriod('AM')}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer active:scale-95 ${
                    period === 'AM'
                      ? 'bg-white text-[#00897b] shadow-md'
                      : 'text-teal-100 hover:bg-teal-700/60 font-bold'
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('PM')}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer active:scale-95 ${
                    period === 'PM'
                      ? 'bg-white text-[#00897b] shadow-md'
                      : 'text-teal-100 hover:bg-teal-700/60 font-bold'
                  }`}
                >
                  PM
                </button>
              </div>

              {/* 24h helper */}
              <div className="hidden sm:block text-xs font-mono text-teal-100 font-bold mt-5 text-center bg-teal-800/40 px-2.5 py-1 rounded-lg">
                24H: {preview24}
              </div>
            </div>

            {/* Right Section: Circular Dial Face & Actions */}
            <div className="flex-1 min-w-0 p-4 sm:p-6 flex flex-col items-center justify-between bg-white">
              {/* Mode Indicator Tabs */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setClockMode('hours')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                    clockMode === 'hours'
                      ? 'bg-teal-50 text-[#00897b] border border-teal-200 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Jam (1 - 12)
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setClockMode('minutes')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                    clockMode === 'minutes'
                      ? 'bg-teal-50 text-[#00897b] border border-teal-200 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Menit (00 - 59)
                </button>
              </div>

              {/* Analog Clock Dial (280px x 280px - Touch Optimized) */}
              <div
                ref={dialRef}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  handleDialPointer(e)
                }}
                onPointerMove={(e) => {
                  if (e.buttons > 0) handleDialPointer(e)
                }}
                onPointerUp={(e) => {
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId)
                  } catch {}
                  if (clockMode === 'hours') {
                    setTimeout(() => setClockMode('minutes'), 180)
                  }
                }}
                className="relative w-[280px] h-[280px] rounded-full bg-slate-100/90 select-none cursor-pointer touch-none shadow-inner border border-slate-200/60"
              >
                {/* Center Pivot Dot */}
                <div className="absolute left-[140px] top-[140px] w-3 h-3 rounded-full bg-[#00897b] -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none shadow-2xs" />

                {/* Hand Stem Line & Indicator Thumb */}
                <div
                  className="absolute left-[140px] top-[140px] pointer-events-none transition-transform duration-100 ease-out z-10"
                  style={{
                    transform: `rotate(${handAngle}deg)`,
                    transformOrigin: '0 0',
                  }}
                >
                  {/* Stem Line from center up to -105px */}
                  <div
                    className="absolute bg-[#00897b] -translate-x-1/2"
                    style={{
                      left: '0px',
                      bottom: '0px',
                      width: '2px',
                      height: '105px',
                    }}
                  />
                  {/* Teal circle thumb at tip (-105px) */}
                  <div
                    className="absolute rounded-full bg-[#00897b] flex items-center justify-center -translate-x-1/2 -translate-y-1/2 shadow-md ring-2 ring-white/40"
                    style={{
                      left: '0px',
                      top: '-105px',
                      width: '38px',
                      height: '38px',
                    }}
                  >
                    <span className="text-white text-sm font-mono font-black select-none">
                      {clockMode === 'hours'
                        ? selectedH12
                        : String(selectedMin).padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* Dial numbers & minute ticks */}
                {clockMode === 'hours'
                  ? HOUR_DIAL_NUMBERS.map((num, i) => {
                      const rad = (i * 30 - 90) * (Math.PI / 180)
                      const left = 140 + 105 * Math.cos(rad)
                      const top = 140 + 105 * Math.sin(rad)
                      const isSelected = num === selectedH12
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedH12(num)
                            setTimeout(() => setClockMode('minutes'), 180)
                          }}
                          style={{
                            left: `${left}px`,
                            top: `${top}px`,
                          }}
                          className={`absolute w-9 h-9 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-mono text-sm font-bold z-20 transition cursor-pointer select-none active:scale-95 ${
                            isSelected
                              ? 'opacity-0 pointer-events-none'
                              : 'text-slate-700 hover:text-[#00897b] hover:bg-teal-50'
                          }`}
                        >
                          {num}
                        </button>
                      )
                    })
                  : Array.from({ length: 60 }, (_, m) => {
                      const rad = (m * 6 - 90) * (Math.PI / 180)
                      const left = 140 + 105 * Math.cos(rad)
                      const top = 140 + 105 * Math.sin(rad)
                      const isSelected = m === selectedMin

                      if (m % 5 === 0) {
                        const numStr = String(m).padStart(2, '0')
                        return (
                          <button
                            key={`min-${m}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedMin(m)
                            }}
                            style={{
                              left: `${left}px`,
                              top: `${top}px`,
                            }}
                            className={`absolute w-9 h-9 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-mono text-sm font-bold z-20 transition cursor-pointer select-none active:scale-95 ${
                              isSelected
                                ? 'opacity-0 pointer-events-none'
                                : 'text-slate-700 hover:text-[#00897b] hover:bg-teal-50'
                            }`}
                          >
                            {numStr}
                          </button>
                        )
                      }

                      // Intermediate minute tick dots (larger touch area for fingers)
                      return (
                        <button
                          key={`tick-${m}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedMin(m)
                          }}
                          style={{
                            left: `${left}px`,
                            top: `${top}px`,
                          }}
                          className={`absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-20 cursor-pointer group active:scale-125 ${
                            isSelected ? 'opacity-0 pointer-events-none' : ''
                          }`}
                          title={`Menit ${String(m).padStart(2, '0')}`}
                        >
                          <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-[#00897b] group-hover:scale-150 transition-transform" />
                        </button>
                      )
                    })}
              </div>

              {/* Minute Fine-Tuning Bar (Touch-Friendly) */}
              {clockMode === 'minutes' ? (
                <div className="flex items-center justify-center gap-1.5 mt-3 bg-slate-50/90 px-3 py-2 rounded-2xl border border-slate-100 max-w-[320px] shadow-2xs">
                  <span className="text-[11px] font-extrabold text-slate-400 mr-0.5">Presisi:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedMin((prev) => (prev - 5 + 60) % 60)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 cursor-pointer active:scale-95 transition"
                    title="Kurang 5 menit"
                  >
                    −5m
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMin((prev) => (prev - 1 + 60) % 60)}
                    className="px-3 py-1 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 cursor-pointer active:scale-95 transition"
                    title="Kurang 1 menit"
                  >
                    −1m
                  </button>
                  <span className="font-mono text-sm font-black text-[#00897b] px-3 bg-teal-50 rounded-lg border border-teal-200 py-1 shadow-2xs">
                    :{String(selectedMin).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedMin((prev) => (prev + 1) % 60)}
                    className="px-3 py-1 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 cursor-pointer active:scale-95 transition"
                    title="Tambah 1 menit"
                  >
                    +1m
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMin((prev) => (prev + 5) % 60)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 cursor-pointer active:scale-95 transition"
                    title="Tambah 5 menit"
                  >
                    +5m
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center mt-3 py-2 text-xs text-slate-400 font-semibold">
                  Ketuk angka jam (1 - 12) atau geser jarum jam
                </div>
              )}

              {/* Bottom Action Buttons (Touch Friendly) */}
              <div className="w-full flex items-center justify-between pt-4 mt-2.5 border-t border-slate-100 px-1">
                <button
                  type="button"
                  onClick={handleResetTimePickerNow}
                  className="text-xs font-bold uppercase tracking-wider text-[#e57373] hover:text-[#d32f2f] px-3 py-2 rounded-xl transition cursor-pointer active:scale-95"
                  title="Atur ke jam sekarang"
                >
                  CLEAR
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTimePicker(false)}
                    className="text-xs font-bold uppercase tracking-wider text-[#00897b] hover:bg-teal-50 px-4 py-2 rounded-xl transition cursor-pointer active:scale-95"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmTimePicker}
                    className="text-xs font-black uppercase tracking-wider text-white bg-[#00897b] hover:bg-[#00796b] px-6 py-2 rounded-xl shadow-md transition cursor-pointer active:scale-95"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH MASTER PART */}
      {showPartForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17202b]/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#a17e00]">Master Data Material</p>
                <h2 className="mt-1 text-xl font-bold">Tambah Master Part Baru</h2>
              </div>
              <button
                onClick={handleClosePartForm}
                aria-label="Close"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 transition"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleAddPart}>
              <div className="space-y-4 p-6">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1.5 text-xs font-bold text-slate-600">FII ID *</label>
                    <input
                      type="text"
                      required
                      value={partId}
                      onChange={(e) => setPartId(e.target.value)}
                      placeholder="Contoh: M173"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#eab308]"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-xs font-bold text-slate-600">PART NUM COIL</label>
                    <input
                      type="text"
                      value={partCoil}
                      onChange={(e) => setPartCoil(e.target.value)}
                      placeholder="Contoh: M173"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#eab308]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-bold text-slate-600">PART NUMBER *</label>
                  <input
                    type="text"
                    required
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    placeholder="Contoh: 3211/711-57300-01"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#eab308]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1.5 text-xs font-bold text-slate-600">COIL SPEC</label>
                    <input
                      type="text"
                      value={partSpec}
                      onChange={(e) => setPartSpec(e.target.value)}
                      placeholder="Contoh: JAC270D+45/45 1.2"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#eab308]"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-xs font-bold text-slate-600">Production Line</label>
                    <input
                      type="text"
                      value={partLine}
                      onChange={(e) => setPartLine(e.target.value)}
                      placeholder="Contoh: YHA / YHB"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#eab308]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-bold text-slate-600">Stok Awal (Opening Stock)</label>
                  <input
                    type="number"
                    min="0"
                    value={partOpening}
                    onChange={(e) => setPartOpening(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#eab308]"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Jumlah unit fisik yang sudah ada di gudang sebelum transaksi dicatat.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 p-6 bg-slate-50/50">
                <button
                  type="button"
                  onClick={handleClosePartForm}
                  className="rounded-lg px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg px-5 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
                  style={{ backgroundColor: 'var(--sf-sidebar-bg)' }}
                >
                  Simpan Master Part
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  detail: string
  icon: typeof Boxes
  tone: string
}) {
  const toneClasses: Record<string, string> = {
    blue:   'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
    green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
    yellow: 'bg-teal-100 text-teal-800 dark:bg-amber-400/15 dark:text-[#f4c430]',
  }
  return (
    <div
      className="rounded-xl border p-5 shadow-xs transition-colors"
      style={{ borderColor: 'var(--sf-header-border)', backgroundColor: 'var(--sf-card-bg)' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>{value}</p>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{detail}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${toneClasses[tone] || toneClasses.blue}`}>
          <Icon size={19} />
        </div>
      </div>
    </div>
  )
}


function LineBar({
  label,
  value,
  amount,
  color,
}: {
  label: string
  value: number
  amount: string
  color: string
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs">
        <span className="font-bold text-slate-700 dark:text-slate-300">Line {label}</span>
        <span className="font-semibold text-slate-500 dark:text-slate-400">
          {amount} <span className="font-normal text-slate-400">units ({value}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-2 rounded-full ${color} transition-all duration-300`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function MovementTable({
  movements,
  parts,
  onDelete,
  onAddNew,
  onEdit,
}: {
  movements: MovementItem[]
  parts: PartItem[]
  onDelete: (id: string) => void
  onAddNew: () => void
  onEdit?: (m: MovementItem) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-[#fafbfc] dark:bg-slate-800/80 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
          <tr>
            <th className="px-5 py-3 font-bold">No Transaksi</th>
            <th className="px-3 py-3 font-bold">Barang / Part</th>
            <th className="px-3 py-3 font-bold">Tanggal</th>
            <th className="px-3 py-3 font-bold">Catatan</th>
            <th className="px-3 py-3 font-bold">Tipe</th>
            <th className="px-5 py-3 text-right font-bold">Jumlah (Qty)</th>
            <th className="px-4 py-3 text-center font-bold">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {movements.map((m) => {
            const partInfo = parts.find((p) => p.id === m.partId)
            return (
              <tr
                key={m.id}
                onClick={() => onEdit?.(m)}
                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition group"
              >
                <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">{m.id}</td>
                <td className="px-3 py-4">
                  <p className="font-bold text-slate-800 dark:text-slate-100">{m.partId}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{partInfo?.part || 'Part'}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-slate-500 dark:text-slate-400">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">{parseDateTimeString(m.date).date}</p>
                  {parseDateTimeString(m.date).time && (
                    <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {parseDateTimeString(m.date).time}
                    </p>
                  )}
                </td>
                <td className="px-3 py-4 text-slate-500 dark:text-slate-400 max-w-[180px] truncate">{m.note}</td>
                <td className="px-3 py-4">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold ${
                      m.type === 'IN'
                        ? 'bg-[#e7f5eb] dark:bg-emerald-950/60 text-[#29934b] dark:text-emerald-400'
                        : 'bg-[#fff0eb] dark:bg-rose-950/60 text-[#c75a42] dark:text-rose-400'
                    }`}
                  >
                    {m.type === 'IN' ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />}
                    {m.type}
                  </span>
                </td>
                <td
                  className={`px-5 py-4 text-right font-bold ${
                    m.type === 'IN' ? 'text-[#29934b] dark:text-emerald-400' : 'text-[#c75a42] dark:text-rose-400'
                  }`}
                >
                  {m.type === 'IN' ? '+' : '-'}
                  {formatNumber(m.qty)}
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {onEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(m)
                        }}
                        title="Edit transaksi"
                        className="p-1 text-slate-400 hover:text-amber-500 transition rounded"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(m.id)
                      }}
                      title="Hapus transaksi"
                      className="p-1 text-slate-300 hover:text-rose-500 transition rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!movements.length && (
        <div className="p-10 text-center">
          <p className="text-xs text-slate-400 mb-2">Belum ada transaksi mutasi stok.</p>
          <button
            onClick={onAddNew}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#a17e00] hover:underline"
          >
            <Plus size={14} /> Tambah transaksi pertama
          </button>
        </div>
      )}
    </div>
  )
}

function PartTable({
  parts,
  partStats,
  onDelete,
  onAddNew,
}: {
  parts: PartItem[]
  partStats: Record<string, { inQty: number; outQty: number; currentStock: number }>
  onDelete: (id: string) => void
  onAddNew: () => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[750px] text-left text-xs">
        <thead className="bg-[#fafbfc] dark:bg-slate-800/80 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
          <tr>
            <th className="px-5 py-3">FII ID</th>
            <th className="px-3 py-3">PART NUMBER</th>
            <th className="px-3 py-3">PART NUM COIL</th>
            <th className="px-3 py-3">COIL SPEC</th>
            <th className="px-3 py-3">Line</th>
            <th className="px-3 py-3 text-right">Stok Awal</th>
            <th className="px-3 py-3 text-right font-bold">Stok Saat Ini</th>
            <th className="px-4 py-3 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {parts.map((p) => {
            const current = partStats[p.id]?.currentStock ?? p.opening
            return (
              <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-100">{p.id}</td>
                <td className="px-3 py-4 font-semibold text-slate-700 dark:text-slate-200">{p.part}</td>
                <td className="px-3 py-4 text-slate-500 dark:text-slate-400">{p.coil}</td>
                <td className="px-3 py-4 text-slate-500 dark:text-slate-400">{p.spec}</td>
                <td className="px-3 py-4">
                  <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {p.line}
                  </span>
                </td>
                <td className="px-3 py-4 text-right text-slate-400 dark:text-slate-500">{formatNumber(p.opening)}</td>
                <td className="px-3 py-4 text-right font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {formatNumber(current)}
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => onDelete(p.id)}
                    title="Hapus part"
                    className="p-1 text-slate-300 hover:text-rose-500 transition rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!parts.length && (
        <div className="p-10 text-center">
          <p className="text-xs text-slate-400 mb-2">Belum ada master part terdaftar.</p>
          <button
            onClick={onAddNew}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#a17e00] hover:underline"
          >
            <Plus size={14} /> Tambah Master Part Baru
          </button>
        </div>
      )}
    </div>
  )
}

function RiwayatTable({
  movements,
  parts,
  onDelete,
  onEdit,
  currentUser = 'Operator',
}: {
  movements: MovementItem[]
  parts: PartItem[]
  onDelete: (id: string) => void
  onEdit?: (m: MovementItem) => void
  currentUser?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              color: 'rgba(255, 255, 255, 0.45)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            }}
          >
            <th className="px-5 py-3.5">Waktu</th>
            <th className="px-4 py-3.5">Part Number</th>
            <th className="px-4 py-3.5">Tipe</th>
            <th className="px-4 py-3.5">User</th>
            <th className="px-4 py-3.5 text-center">PO</th>
            <th className="px-5 py-3.5 text-right">Total</th>
            <th className="px-4 py-3.5 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
          {movements.map((m) => {
            const partInfo = parts.find((p) => p.id === m.partId)
            const isIN = m.type === 'IN'

            return (
              <tr
                key={m.id}
                onClick={() => onEdit?.(m)}
                className="riwayat-table-row transition-colors group cursor-pointer"
              >
                {/* Waktu */}
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-1 h-7 rounded-full shrink-0 ${
                        isIN ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-rose-500 dark:bg-rose-400'
                      }`}
                      style={{
                        boxShadow: isIN
                          ? '0 0 8px rgba(52, 211, 153, 0.4)'
                          : '0 0 8px rgba(251, 113, 133, 0.4)',
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                        <Clock size={12} style={{ color: 'var(--sf-brand)' }} />
                        <span>{parseDateTimeString(m.date).date}</span>
                        {parseDateTimeString(m.date).time && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-teal-800 dark:text-amber-300 font-semibold border border-slate-200 dark:border-white/5">
                            {parseDateTimeString(m.date).time}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[150px] truncate">
                        {m.note || m.id}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Part Number */}
                <td className="px-4 py-3.5">
                  <div className="flex flex-col gap-0.5">
                    <span
                      className="font-mono font-bold text-xs inline-block"
                      style={{ color: 'var(--sf-brand)' }}
                    >
                      {partInfo?.part || m.partId}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{m.partId}</span>
                      {partInfo?.line && (
                        <>
                          <span>&middot;</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                            Line {partInfo.line}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </td>

                {/* Tipe */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      isIN
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {isIN ? (
                      <ArrowDownToLine size={12} className="stroke-[2.5]" />
                    ) : (
                      <ArrowUpFromLine size={12} className="stroke-[2.5]" />
                    )}
                    {isIN ? 'MASUK' : 'KELUAR'}
                  </span>
                </td>

                {/* User */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0"
                      style={{
                        background:
                          m.role === 'RECEIVING'
                            ? 'linear-gradient(135deg, rgba(41,147,75,0.35) 0%, rgba(41,147,75,0.1) 100%)'
                            : m.role === 'PRODUCTION'
                            ? 'linear-gradient(135deg, rgba(239,68,68,0.35) 0%, rgba(239,68,68,0.1) 100%)'
                            : 'var(--sf-brand-light)',
                        color:
                          m.role === 'RECEIVING'
                            ? '#34d399'
                            : m.role === 'PRODUCTION'
                            ? '#f87171'
                            : 'var(--sf-brand)',
                        border: '1px solid var(--sf-brand-light)',
                      }}
                    >
                      {(m.operator || currentUser || 'O').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 block">
                        {m.operator || currentUser}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block -mt-0.5">
                        {m.role && ROLES[m.role as UserRole]
                          ? ROLES[m.role as UserRole].label
                          : 'Operator Gudang'}
                      </span>
                    </div>
                  </div>
                </td>

                {/* PO */}
                <td className="px-4 py-3.5 text-center text-slate-400 font-mono">
                  —
                </td>

                {/* Total */}
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <span
                    className={`font-mono font-bold text-sm ${
                      isIN ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isIN ? '+' : '-'}
                    {formatNumber(m.qty)}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">pcs</span>
                </td>

                {/* Aksi */}
                <td className="px-4 py-3.5 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onEdit) {
                          onEdit(m)
                        } else {
                          alert(`Detail Mutasi ${m.id}:\nPart: ${partInfo?.part || m.partId}\nTipe: ${m.type}\nQty: ${m.qty}\nTanggal: ${m.date}\nCatatan: ${m.note || '-'}`)
                        }
                      }}
                      title="Edit transaksi"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 dark:hover:text-[#f4c430] hover:bg-slate-100 dark:hover:bg-white/5 transition"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(m.id)
                      }}
                      title="Hapus transaksi"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
