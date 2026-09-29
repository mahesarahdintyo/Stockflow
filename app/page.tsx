'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  Boxes,
  Calendar,
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
  MoreHorizontal,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
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
  const [month, setMonth] = useState('September 2026')
  const [lineFilter, setLineFilter] = useState('All lines')

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

  // Movement Form fields (PKIS-PLUS standard)
  const [movType, setMovType] = useState<'IN' | 'OUT'>('IN')
  const [selectedPartId, setSelectedPartId] = useState('')
  const [movQty, setMovQty] = useState('100')
  const [movDate, setMovDate] = useState(() => getLocalDateString())
  const [movTime, setMovTime] = useState(() => getLocalTimeString())
  const [movNote, setMovNote] = useState('')

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
    setMovDate(getLocalDateString())
    setMovTime(getLocalTimeString())
    setMovQty('100')
    setMovNote('')
    setShowMovementForm(true)
  }

  function handleCloseMovementForm() {
    setShowMovementForm(false)
    setMovNote('')
  }

  // Add Movement handler with Role Enforcement
  function handleAddMovement() {
    const qty = Number(movQty)
    if (!selectedPartId || !qty || qty < 1) return

    // Enforce role permission
    if (!ROLES[currentRole].allowedTypes.includes(movType)) {
      alert(`Role ${ROLES[currentRole].name} tidak diizinkan mencatat transaksi tipe ${movType}!`)
      return
    }

    const datePart = movDate || getLocalDateString()
    const timePart = movTime || getLocalTimeString()
    // Format ISO 8601 standard PKIS-PLUS
    const fullDate = `${datePart}T${timePart}`

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
    setShowMovementForm(false)
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
    <div className="min-h-screen bg-[#f4f5f7] text-[#17202b]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-[#202932] text-white lg:flex">
        <div className="flex h-[82px] items-center gap-3 border-b border-white/10 px-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4c430] text-[#202932]">
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
                    ? 'bg-[#f4c430] text-[#17202b] shadow-lg shadow-yellow-900/10 font-bold'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4c430] text-xs font-bold text-[#202932]">
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
        <header className="flex h-[82px] items-center justify-between border-b border-[#e0e4e8] bg-white px-5 sm:px-9">
          <div>
            <p className="text-xs font-medium text-slate-400">Production Inventory / {activePage}</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">{activePage}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Role Switcher Simulator */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
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
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer pr-1"
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

            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Penyimpanan Browser
            </span>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] p-5 sm:p-9">
          {/* DASHBOARD PAGE */}
          {activePage === 'Dashboard' && (
            <>
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
                    className="flex items-center gap-2 rounded-lg bg-[#202932] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#2c3945] transition"
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
                <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="font-bold">Transaksi Terkini</h3>
                      <p className="mt-1 text-xs text-slate-400">Riwayat transaksi masuk & keluar terbaru</p>
                    </div>
                    <button
                      onClick={() => setActivePage('Stock Movement')}
                      className="text-xs font-bold text-[#a17e00] hover:underline"
                    >
                      Lihat Semua Transaksi →
                    </button>
                  </div>
                  <MovementTable
                    movements={visibleMovements.slice(0, 5)}
                    parts={parts}
                    onDelete={handleDeleteMovement}
                    onAddNew={handleOpenMovementForm}
                  />
                </section>

                <section className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="border-b border-slate-100 p-5">
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
                  <div className="m-5 rounded-lg bg-amber-50/70 border border-amber-200/60 p-3.5 text-xs text-amber-900">
                    <p className="font-bold mb-0.5">ℹ️ Mode Mandiri (Tanpa Akun)</p>
                    <p className="text-amber-800 text-[11px] leading-relaxed">
                      Semua data yang Anda input otomatis tersimpan di penyimpanan lokal browser Anda. Anda bebas menguji coba input transaksi tanpa perlu registrasi atau membuat akun Supabase.
                    </p>
                  </div>
                </section>
              </div>

              {/* Part Table Section */}
              <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
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
                        className="w-48 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-[#eab308]"
                      />
                    </div>
                    <button
                      onClick={handleOpenPartForm}
                      className="flex items-center gap-1.5 rounded-lg bg-[#202932] px-3 py-2 text-xs font-bold text-white hover:bg-[#2c3945]"
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
            </>
          )}

          {/* STOCK MOVEMENT PAGE */}
          {activePage === 'Stock Movement' && (
            <>
              <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="mb-1 text-sm text-slate-500">Pencatatan mutasi barang masuk & keluar</p>
                  <h2 className="text-2xl font-bold">Stock Movement</h2>
                </div>
                <button
                  onClick={handleOpenMovementForm}
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#202932] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#2c3945]"
                >
                  <Plus size={16} /> Input Movement
                </button>
              </div>

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
                />
              </div>
            </>
          )}

          {/* MASTER PART PAGE */}
          {activePage === 'Master Part' && (
            <>
              <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="mb-1 text-sm text-slate-500">Database spesifikasi & stok awal material</p>
                  <h2 className="text-2xl font-bold">Master Part</h2>
                </div>
                <button
                  onClick={handleOpenPartForm}
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#202932] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#2c3945]"
                >
                  <Plus size={16} /> + Tambah Part Baru
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
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
                      className="w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-[#eab308]"
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
            </>
          )}

          {/* REPORT PAGE */}
          {activePage === 'Report' && (
            <>
              <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="mb-1 text-sm text-slate-500">Laporan akumulasi mutasi dan saldo akhir</p>
                  <h2 className="text-2xl font-bold">Stock Report</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
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

              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold">Laporan Saldo per Part</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Perhitungan stok awal, total penerimaan (IN), pengeluaran (OUT), dan saldo akhir
                </p>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
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
                    <tbody className="divide-y divide-slate-100">
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
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="py-4 px-3 font-bold text-slate-800">{p.id}</td>
                              <td className="py-4 px-3 text-slate-600">{p.part}</td>
                              <td className="py-4 px-3 font-semibold">{p.line}</td>
                              <td className="py-4 px-3 text-right text-slate-500">{formatNumber(p.opening)}</td>
                              <td className="py-4 px-3 text-right font-semibold text-[#29934b]">
                                {stats.inQty > 0 ? `+${formatNumber(stats.inQty)}` : '0'}
                              </td>
                              <td className="py-4 px-3 text-right font-semibold text-[#c75a42]">
                                {stats.outQty > 0 ? `-${formatNumber(stats.outQty)}` : '0'}
                              </td>
                              <td className="py-4 px-3 text-right font-bold text-slate-800">
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
            </>
          )}

          {/* RIWAYAT PAGE */}
          {activePage === 'Riwayat' && (
            <div className="riwayat-fade-in" style={{ minHeight: '80vh' }}>
              {/* Page Hero Header */}
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #f4c430 0%, #d4a017 100%)' }}>
                      <History size={18} className="text-[#202932]" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-400">Stockflow / Riwayat</p>
                      <h2 className="text-2xl font-bold tracking-tight">Riwayat Transaksi</h2>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 pl-11">Log lengkap semua pergerakan stok masuk dan keluar</p>
                </div>
                <div className="flex items-center gap-2 pl-11 sm:pl-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(244,196,48,0.1)', color: '#f4c430', border: '1px solid rgba(244,196,48,0.2)' }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#f4c430] animate-pulse"></span>
                    {riwayatFiltered.length} transaksi ditemukan
                  </span>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {/* Total Transaksi */}
                <div className="rounded-2xl p-5 stat-glow-yellow" style={{ background: 'linear-gradient(135deg, #202932 0%, #263240 100%)', border: '1px solid rgba(244,196,48,0.15)' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>TOTAL TRANSAKSI</p>
                      <p className="text-3xl font-bold" style={{ color: '#f4c430' }}>{formatNumber(riwayatFiltered.length)}</p>
                      <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>dalam rentang tanggal dipilih</p>
                    </div>
                    <div className="rounded-xl p-2.5" style={{ background: 'rgba(244,196,48,0.1)' }}>
                      <History size={20} style={{ color: '#f4c430' }} />
                    </div>
                  </div>
                </div>
                {/* Transaksi Masuk */}
                <div className="rounded-2xl p-5 stat-glow-green" style={{ background: 'linear-gradient(135deg, #1a2920 0%, #1e3125 100%)', border: '1px solid rgba(74,222,128,0.12)' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>BARANG MASUK (IN)</p>
                      <p className="text-3xl font-bold" style={{ color: '#4ade80' }}>
                        {formatNumber(riwayatFiltered.filter(m => m.type === 'IN').reduce((s, m) => s + m.qty, 0))}
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {riwayatFiltered.filter(m => m.type === 'IN').length} transaksi masuk
                      </p>
                    </div>
                    <div className="rounded-xl p-2.5" style={{ background: 'rgba(74,222,128,0.1)' }}>
                      <ArrowDownToLine size={20} style={{ color: '#4ade80' }} />
                    </div>
                  </div>
                </div>
                {/* Transaksi Keluar */}
                <div className="rounded-2xl p-5 stat-glow-blue" style={{ background: 'linear-gradient(135deg, #201a1a 0%, #291e1e 100%)', border: '1px solid rgba(248,113,113,0.12)' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>BARANG KELUAR (OUT)</p>
                      <p className="text-3xl font-bold" style={{ color: '#f87171' }}>
                        {formatNumber(riwayatFiltered.filter(m => m.type === 'OUT').reduce((s, m) => s + m.qty, 0))}
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {riwayatFiltered.filter(m => m.type === 'OUT').length} transaksi keluar
                      </p>
                    </div>
                    <div className="rounded-xl p-2.5" style={{ background: 'rgba(248,113,113,0.1)' }}>
                      <ArrowUpFromLine size={20} style={{ color: '#f87171' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Card */}
              <div className="rounded-2xl overflow-hidden" style={{ background: '#202932', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 8px 32px rgba(0,0,0,0.24)' }}>
                {/* Filter Bar */}
                <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  {/* Tablet Quick Range Chips */}
                  <div className="mb-3.5 flex flex-wrap items-center gap-1.5 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest mr-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
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
                              ? 'bg-[#f4c430] text-[#202932] shadow-sm'
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
                      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Dari Tanggal
                      </label>
                      <div className="relative">
                        <Calendar size={13} className="absolute left-3 top-2.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
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
                      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Sampai Tanggal
                      </label>
                      <div className="relative">
                        <Calendar size={13} className="absolute left-3 top-2.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
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
                      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Item / Part
                      </label>
                      <select
                        id="riwayat-part-filter"
                        value={riwayatPartFilter}
                        onChange={(e) => { setRiwayatPartFilter(e.target.value); setRiwayatPage(1) }}
                        className="riwayat-filter-input rounded-xl px-3 py-2 text-xs min-w-[180px] cursor-pointer"
                      >
                        <option value="ALL" style={{ background: '#202932' }}>SEMUA ITEM</option>
                        {parts.map((p) => (
                          <option key={p.id} value={p.id} style={{ background: '#202932' }}>
                            {p.id} — {p.part}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Filter Tipe IN / OUT */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Tipe
                      </label>
                      <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                          type="button"
                          onClick={() => { setRiwayatTypeFilter('ALL'); setRiwayatPage(1) }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                            riwayatTypeFilter === 'ALL'
                              ? 'bg-[#f4c430] text-[#202932] shadow-sm'
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
                              : 'text-emerald-400 hover:bg-emerald-500/10'
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
                              : 'text-rose-400 hover:bg-rose-500/10'
                          }`}
                        >
                          <ArrowUpFromLine size={12} /> OUT
                        </button>
                      </div>
                    </div>

                    {/* Search */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
                      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Cari
                      </label>
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-2.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
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
                        className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition"
                        style={{ background: 'linear-gradient(135deg, #f4c430 0%, #d4a017 100%)', color: '#202932' }}
                      >
                        <Search size={13} />
                        Cari
                      </button>
                      <button
                        id="riwayat-reset-btn"
                        onClick={handleRiwayatReset}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
                      >
                        <RotateCcw size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Table or Empty */}
                {riwayatFiltered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <History size={36} style={{ color: 'rgba(255,255,255,0.15)' }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Tidak ada transaksi ditemukan</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Coba ubah filter tanggal atau pilih item yang berbeda</p>
                    </div>
                    <button
                      onClick={handleRiwayatReset}
                      className="text-xs font-bold px-4 py-2 rounded-xl transition"
                      style={{ color: '#f4c430', background: 'rgba(244,196,48,0.08)', border: '1px solid rgba(244,196,48,0.15)' }}
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
                      currentUser="Operator"
                    />

                    {/* Pagination */}
                    {riwayatTotalPages > 1 && (
                      <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          Halaman <span style={{ color: 'rgba(255,255,255,0.6)' }}>{riwayatPage}</span> dari <span style={{ color: 'rgba(255,255,255,0.6)' }}>{riwayatTotalPages}</span>
                          &nbsp;&middot;&nbsp;{riwayatFiltered.length} total transaksi
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            id="riwayat-prev-page"
                            onClick={() => setRiwayatPage(p => Math.max(1, p - 1))}
                            disabled={riwayatPage === 1}
                            className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:opacity-30"
                            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
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
                                className="w-8 h-8 rounded-xl text-xs font-bold transition"
                                style={page === riwayatPage
                                  ? { background: '#f4c430', color: '#202932' }
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
                            className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:opacity-30"
                            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
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
          className="flex items-center gap-2.5 rounded-2xl px-4 py-3.5 text-xs sm:text-sm font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all duration-150 border border-amber-300/40"
          style={{
            background: 'linear-gradient(135deg, #f4c430 0%, #d4a017 100%)',
            color: '#202932',
            boxShadow: '0 10px 25px -4px rgba(244, 196, 48, 0.45), 0 6px 12px -3px rgba(0, 0, 0, 0.25)',
          }}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#202932] text-white">
            <Plus size={15} className="stroke-[3]" />
          </div>
          <span className="font-extrabold tracking-wide">Input Mutasi</span>
        </button>
      </div>

      {/* MODAL INPUT PERGERAKAN (IN / OUT) */}
      {showMovementForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17202b]/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#a17e00]">Form Mutasi Stok</p>
                <h2 className="mt-1 text-xl font-bold">Input Pergerakan Barang</h2>
              </div>
              <button
                onClick={handleCloseMovementForm}
                aria-label="Close"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 transition"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4 p-6">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Tanggal & Waktu Transaksi (Sistem Standar PKIS-PLUS) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <Calendar size={13} className="text-indigo-500" /> Tanggal & Waktu
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setMovDate(getLocalDateString())}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer active:scale-95 transition ${
                          movDate === getLocalDateString()
                            ? 'text-blue-600 bg-blue-500/15 border border-blue-400/30'
                            : 'text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200'
                        }`}
                      >
                        Hari Ini
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = new Date()
                          target.setDate(target.getDate() - 1)
                          setMovDate(getLocalDateString(target))
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer active:scale-95 transition ${
                          (() => {
                            const d = new Date()
                            d.setDate(d.getDate() - 1)
                            return movDate === getLocalDateString(d)
                          })()
                            ? 'text-blue-600 bg-blue-500/15 border border-blue-400/30'
                            : 'text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200'
                        }`}
                      >
                        Kemarin
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date()
                          setMovDate(getLocalDateString(now))
                          setMovTime(getLocalTimeString(now))
                        }}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-500/15 hover:bg-emerald-500/25 px-2 py-0.5 rounded cursor-pointer active:scale-95 transition flex items-center gap-0.5"
                      >
                        ⚡ Sekarang
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={movDate}
                      onChange={(e) => setMovDate(e.target.value)}
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono font-semibold bg-white outline-none focus:border-[#eab308]"
                    />
                    <input
                      type="time"
                      value={movTime}
                      onChange={(e) => setMovTime(e.target.value)}
                      className="w-28 h-9 rounded-lg border border-slate-200 px-2 py-2 text-xs font-mono font-semibold bg-white outline-none focus:border-[#eab308]"
                    />
                  </div>

                  {/* Stepper Cepat Hari & Live Timestamp Display */}
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const base = movDate ? new Date(movDate) : new Date()
                          base.setDate(base.getDate() - 1)
                          setMovDate(getLocalDateString(base))
                        }}
                        title="Mundur 1 Hari"
                        className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold active:scale-95 transition"
                      >
                        ◀ -1 Hari
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const base = movDate ? new Date(movDate) : new Date()
                          base.setDate(base.getDate() + 1)
                          setMovDate(getLocalDateString(base))
                        }}
                        title="Maju 1 Hari"
                        className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold active:scale-95 transition"
                      >
                        +1 Hari ▶
                      </button>
                    </div>
                    <span className="font-mono text-slate-500 text-[10px] font-medium">
                      {fmt(movDate ? `${movDate}T${movTime || '00:00'}` : null)}
                    </span>
                  </div>
                </div>

                {/* Jumlah (Qty) dengan Touch Stepper & Quick Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-600">Jumlah (Qty)</label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatNumber(Number(movQty) || 0)} pcs
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMovQty((prev) => String(Math.max(1, (Number(prev) || 0) - 10)))}
                      className="h-10 w-11 shrink-0 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 active:scale-95 transition flex items-center justify-center text-xs"
                    >
                      -10
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={movQty}
                      onChange={(e) => setMovQty(e.target.value)}
                      className="w-full text-center font-bold text-sm rounded-lg border border-slate-200 px-2 py-2 outline-none focus:border-[#eab308]"
                      placeholder="100"
                    />
                    <button
                      type="button"
                      onClick={() => setMovQty((prev) => String((Number(prev) || 0) + 10))}
                      className="h-10 w-11 shrink-0 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 active:scale-95 transition flex items-center justify-center text-xs"
                    >
                      +10
                    </button>
                  </div>
                  {/* Quick Qty Preset Chips */}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {[50, 100, 250, 500].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMovQty(String(preset))}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition active:scale-95 ${
                          Number(movQty) === preset
                            ? 'bg-[#f4c430] text-[#202932] shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMovQty((prev) => String((Number(prev) || 0) + 100))}
                      className="px-2 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 active:scale-95 transition"
                    >
                      +100
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-600">Tipe Pergerakan</span>
                  {currentRole !== 'SUPERVISOR' && (
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 flex items-center gap-1">
                      <Lock size={10} /> Terkunci untuk {ROLES[currentRole].name}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!ROLES[currentRole].allowedTypes.includes('IN')}
                    onClick={() => setMovType('IN')}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition ${
                      movType === 'IN'
                        ? 'border-[#29934b] bg-[#eaf6ed] text-[#29934b] shadow-sm'
                        : !ROLES[currentRole].allowedTypes.includes('IN')
                        ? 'border-slate-100 bg-slate-100/70 text-slate-300 cursor-not-allowed opacity-60'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowDownToLine size={16} /> MASUK (IN)
                  </button>
                  <button
                    type="button"
                    disabled={!ROLES[currentRole].allowedTypes.includes('OUT')}
                    onClick={() => setMovType('OUT')}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition ${
                      movType === 'OUT'
                        ? 'border-[#c75a42] bg-[#fff0eb] text-[#c75a42] shadow-sm'
                        : !ROLES[currentRole].allowedTypes.includes('OUT')
                        ? 'border-slate-100 bg-slate-100/70 text-slate-300 cursor-not-allowed opacity-60'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowUpFromLine size={16} /> KELUAR (OUT)
                  </button>
                </div>
                {/* Role guidance notice */}
                {currentRole === 'RECEIVING' && (
                  <p className="mt-1.5 text-[11px] text-emerald-700 bg-emerald-50/70 rounded-md px-2.5 py-1 border border-emerald-100 flex items-center gap-1.5">
                    🟢 Role <strong>Operator Receiving</strong> hanya berwenang mencatat pergerakan barang masuk (IN).
                  </p>
                )}
                {currentRole === 'PRODUCTION' && (
                  <p className="mt-1.5 text-[11px] text-rose-700 bg-rose-50/70 rounded-md px-2.5 py-1 border border-rose-100 flex items-center gap-1.5">
                    🔴 Role <strong>Operator Produksi</strong> hanya berwenang mencatat pemakaian/pengeluaran barang (OUT).
                  </p>
                )}
              </div>

              {/* Keterangan / Catatan dengan Preset Chips untuk Tablet */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-600">Keterangan / Catatan</label>
                  <span className="text-[10px] text-slate-400">Tap pilihan di bawah atau ketik manual</span>
                </div>
                <input
                  type="text"
                  value={movNote}
                  onChange={(e) => setMovNote(e.target.value)}
                  placeholder="Pilih tombol di bawah atau ketik..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#eab308]"
                />
                {/* Quick Note Chips */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {movType === 'IN' ? (
                    <>
                      {[
                        'Input dari Supplier',
                        'Bongkar Kontainer',
                        'Retur Produksi',
                        'Koreksi Stok Fisik',
                        'Kedatangan Material Baru',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setMovNote(preset)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border transition active:scale-95 ${
                            movNote === preset
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold shadow-xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      {[
                        'Pemakaian Line YHA',
                        'Pemakaian Line YHB',
                        'Supply Setting Dies',
                        'Scrap / Part Defect',
                        'Trial Line Produksi',
                        'Sample Quality Control',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setMovNote(preset)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border transition active:scale-95 ${
                            movNote === preset
                              ? 'bg-rose-50 text-rose-800 border-rose-300 font-bold shadow-xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </>
                  )}
                  {movNote && (
                    <button
                      type="button"
                      onClick={() => setMovNote('')}
                      className="text-[11px] px-2 py-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Live Preview Balance */}
              {selectedPartId && parts.length > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-[#f7f8fa] p-4 text-sm border border-slate-100">
                  <div>
                    <p className="text-xs text-slate-400">Stok Saat Ini</p>
                    <p className="mt-0.5 font-bold text-slate-700">
                      {formatNumber(partStats[selectedPartId]?.currentStock ?? 0)} units
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Estimasi Saldo Baru</p>
                    {(() => {
                      const cur = partStats[selectedPartId]?.currentStock ?? 0
                      const change = (movType === 'IN' ? 1 : -1) * (Number(movQty) || 0)
                      const next = cur + change
                      return (
                        <p className={`mt-0.5 font-bold ${next < 0 ? 'text-[#c75a42]' : 'text-[#29934b]'}`}>
                          {formatNumber(next)} units {next < 0 && '(Minus)'}
                        </p>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 p-6 bg-slate-50/50">
              <button
                type="button"
                onClick={handleCloseMovementForm}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={parts.length === 0}
                onClick={handleAddMovement}
                className="rounded-lg bg-[#202932] px-5 py-2 text-xs font-bold text-white hover:bg-[#2c3945] disabled:opacity-50 shadow-sm"
              >
                Simpan Transaksi
              </button>
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
                  className="rounded-lg bg-[#202932] px-5 py-2 text-xs font-bold text-white hover:bg-[#2c3945] shadow-sm"
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
  const styles: Record<string, string> = {
    blue: 'bg-[#edf3f7] text-[#567487]',
    green: 'bg-[#eaf6ed] text-[#29934b]',
    orange: 'bg-[#fff3e7] text-[#d67b27]',
    yellow: 'bg-[#fff8d9] text-[#b58a00]',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-slate-800">{value}</p>
          <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${styles[tone]}`}>
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
        <span className="font-bold text-slate-700">Line {label}</span>
        <span className="font-semibold text-slate-500">
          {amount} <span className="font-normal text-slate-400">units ({value}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
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
}: {
  movements: MovementItem[]
  parts: PartItem[]
  onDelete: (id: string) => void
  onAddNew: () => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-[#fafbfc] text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
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
        <tbody className="divide-y divide-slate-100">
          {movements.map((m) => {
            const partInfo = parts.find((p) => p.id === m.partId)
            return (
              <tr key={m.id} className="hover:bg-slate-50/80 transition">
                <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-700">{m.id}</td>
                <td className="px-3 py-4">
                  <p className="font-bold text-slate-800">{m.partId}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{partInfo?.part || 'Part'}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-slate-500">
                  <p className="font-semibold text-slate-700">{parseDateTimeString(m.date).date}</p>
                  {parseDateTimeString(m.date).time && (
                    <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {parseDateTimeString(m.date).time}
                    </p>
                  )}
                </td>
                <td className="px-3 py-4 text-slate-500 max-w-[180px] truncate">{m.note}</td>
                <td className="px-3 py-4">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold ${
                      m.type === 'IN' ? 'bg-[#e7f5eb] text-[#29934b]' : 'bg-[#fff0eb] text-[#c75a42]'
                    }`}
                  >
                    {m.type === 'IN' ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />}
                    {m.type}
                  </span>
                </td>
                <td
                  className={`px-5 py-4 text-right font-bold ${
                    m.type === 'IN' ? 'text-[#29934b]' : 'text-[#c75a42]'
                  }`}
                >
                  {m.type === 'IN' ? '+' : '-'}
                  {formatNumber(m.qty)}
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => onDelete(m.id)}
                    title="Hapus transaksi"
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
        <thead className="bg-[#fafbfc] text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
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
        <tbody className="divide-y divide-slate-100">
          {parts.map((p) => {
            const current = partStats[p.id]?.currentStock ?? p.opening
            return (
              <tr key={p.id} className="hover:bg-slate-50/80 transition">
                <td className="px-5 py-4 font-bold text-slate-800">{p.id}</td>
                <td className="px-3 py-4 font-semibold text-slate-700">{p.part}</td>
                <td className="px-3 py-4 text-slate-500">{p.coil}</td>
                <td className="px-3 py-4 text-slate-500">{p.spec}</td>
                <td className="px-3 py-4">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {p.line}
                  </span>
                </td>
                <td className="px-3 py-4 text-right text-slate-400">{formatNumber(p.opening)}</td>
                <td className="px-3 py-4 text-right font-bold text-slate-900 text-sm">
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
  currentUser = 'Operator',
}: {
  movements: MovementItem[]
  parts: PartItem[]
  onDelete: (id: string) => void
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
        <tbody className="divide-y divide-white/[0.04]">
          {movements.map((m) => {
            const partInfo = parts.find((p) => p.id === m.partId)
            const isIN = m.type === 'IN'
            const userInitial = (currentUser || 'O').charAt(0).toUpperCase()

            return (
              <tr
                key={m.id}
                className="riwayat-table-row transition-colors group"
              >
                {/* Waktu */}
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-1 h-7 rounded-full shrink-0 ${
                        isIN ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                      style={{
                        boxShadow: isIN
                          ? '0 0 8px rgba(52, 211, 153, 0.4)'
                          : '0 0 8px rgba(251, 113, 133, 0.4)',
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-slate-200 font-semibold text-xs">
                        <Clock size={12} className="text-[#f4c430]/80" />
                        <span>{parseDateTimeString(m.date).date}</span>
                        {parseDateTimeString(m.date).time && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-amber-300 font-semibold border border-white/5">
                            {parseDateTimeString(m.date).time}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 max-w-[150px] truncate">
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
                      style={{ color: '#f4c430' }}
                    >
                      {partInfo?.part || m.partId}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-300">{m.partId}</span>
                      {partInfo?.line && (
                        <>
                          <span>&middot;</span>
                          <span className="px-1.5 py-0.2 rounded bg-white/5 text-slate-300">
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
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
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
                            : 'linear-gradient(135deg, rgba(244,196,48,0.25) 0%, rgba(244,196,48,0.08) 100%)',
                        color:
                          m.role === 'RECEIVING'
                            ? '#34d399'
                            : m.role === 'PRODUCTION'
                            ? '#f87171'
                            : '#f4c430',
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}
                    >
                      {(m.operator || currentUser || 'O').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-200 block">
                        {m.operator || currentUser}
                      </span>
                      <span className="text-[10px] text-slate-400 block -mt-0.5">
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
                      isIN ? 'text-emerald-400' : 'text-rose-400'
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
                      onClick={() => alert(`Detail Mutasi ${m.id}:\nPart: ${partInfo?.part || m.partId}\nTipe: ${m.type}\nQty: ${m.qty}\nTanggal: ${m.date}\nCatatan: ${m.note || '-'}`)}
                      title="Edit / Detail catatan transaksi"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#f4c430] hover:bg-white/5 transition"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => onDelete(m.id)}
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
