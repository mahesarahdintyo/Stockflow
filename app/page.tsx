'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  ClipboardList,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  MoreHorizontal,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
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
}

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Stock Movement', icon: ClipboardList },
  { label: 'Master Part', icon: Boxes },
  { label: 'Report', icon: BarChart3 },
]

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
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

  // Movement Form fields
  const [movType, setMovType] = useState<'IN' | 'OUT'>('IN')
  const [selectedPartId, setSelectedPartId] = useState('')
  const [movQty, setMovQty] = useState('100')
  const [movDate, setMovDate] = useState(() => new Date().toISOString().split('T')[0])
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
      if (savedParts) {
        const parsed = JSON.parse(savedParts)
        if (Array.isArray(parsed)) setParts(parsed)
      }
      if (savedMovements) {
        const parsed = JSON.parse(savedMovements)
        if (Array.isArray(parsed)) setMovements(parsed)
      }
    } catch (e) {
      console.error('Failed to load local data:', e)
    } finally {
      setIsLoaded(true)
    }
  }, [])

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
      const queryTarget = `${movement.id} ${movement.partId} ${part?.part || ''} ${part?.coil || ''} ${movement.note}`.toLowerCase()
      const matchesQuery = !query || queryTarget.includes(query.toLowerCase())
      return matchesLine && matchesQuery
    })
  }, [movements, parts, lineFilter, query])

  // Available unique lines
  const availableLines = useMemo(() => {
    const set = new Set<string>()
    parts.forEach((p) => {
      if (p.line) set.add(p.line)
    })
    return Array.from(set)
  }, [parts])

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
    setMovNote('')
    setShowMovementForm(true)
  }

  function handleCloseMovementForm() {
    setShowMovementForm(false)
    setMovNote('')
  }

  // Add Movement handler
  function handleAddMovement() {
    const qty = Number(movQty)
    if (!selectedPartId || !qty || qty < 1) return

    const newMov: MovementItem = {
      id: `TRX-${String(movements.length + 1).padStart(4, '0')}`,
      partId: selectedPartId,
      date: movDate || new Date().toISOString().split('T')[0],
      type: movType,
      qty,
      note: movNote.trim() || '-',
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
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
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
        </div>
      </main>

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1.5 text-xs font-bold text-slate-600">Tanggal Transaksi</label>
                  <input
                    type="date"
                    value={movDate}
                    onChange={(e) => setMovDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#eab308]"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 text-xs font-bold text-slate-600">Jumlah (Qty)</label>
                  <input
                    type="number"
                    min="1"
                    value={movQty}
                    onChange={(e) => setMovQty(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#eab308]"
                    placeholder="Contoh: 100"
                  />
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-bold text-slate-600">Tipe Pergerakan</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMovType('IN')}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition ${
                      movType === 'IN'
                        ? 'border-[#29934b] bg-[#eaf6ed] text-[#29934b] shadow-sm'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowDownToLine size={16} /> MASUK (IN)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovType('OUT')}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition ${
                      movType === 'OUT'
                        ? 'border-[#c75a42] bg-[#fff0eb] text-[#c75a42] shadow-sm'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowUpFromLine size={16} /> KELUAR (OUT)
                  </button>
                </div>
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-bold text-slate-600">Keterangan / Catatan</label>
                <input
                  type="text"
                  value={movNote}
                  onChange={(e) => setMovNote(e.target.value)}
                  placeholder="Contoh: Pemakaian Line YHA / Input dari Supplier"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#eab308]"
                />
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
                <td className="whitespace-nowrap px-3 py-4 text-slate-500">{m.date}</td>
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
            <Plus size={14} /> + Tambah Master Part Baru
          </button>
        </div>
      )}
    </div>
  )
}
