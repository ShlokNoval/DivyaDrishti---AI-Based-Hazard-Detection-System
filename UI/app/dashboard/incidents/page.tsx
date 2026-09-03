"use client"

import { Suspense } from "react"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Incident } from "@/lib/types"
import { getIncidents } from "@/lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HazardIcon } from "@/components/shared/hazard-icon"
import { SeverityBadge } from "@/components/shared/severity-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { Search, SlidersHorizontal, ArrowUpDown, MoreVertical, CheckCircle2, Clock, Hammer, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuGroup, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { updateIncidentStatus } from "@/lib/api"
import { toast } from "sonner"
import { MessageSquareShare, UserPlus } from "lucide-react"
import { useSearchParams } from "next/navigation"

function IncidentsPageContent() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [filtered, setFiltered] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  
  // Filter States
  const [filterType, setFilterType] = useState<string>("all")
  const [filterSeverity, setFilterSeverity] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  
  // Sharing States
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState("91")
  const [sharingContext, setSharingContext] = useState<"all" | Incident>("all")
  const searchParams = useSearchParams()

  useEffect(() => {
    const query = searchParams.get('q')
    if (query) {
      setSearch(query)
    }
  }, [searchParams])

  useEffect(() => {
    getIncidents()
      .then(data => {
        setIncidents(data)
        setFiltered(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let result = [...incidents]
    
    // Search Query (ID, Camera, or Type)
    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(i => 
        i.id.toLowerCase().includes(lower) || 
        (i.camera?.name || "").toLowerCase().includes(lower) ||
        i.hazard_type.toLowerCase().includes(lower)
      )
    }
    
    // Discrete Filters
    if (filterType !== "all") {
      result = result.filter(i => i.hazard_type === filterType)
    }
    if (filterSeverity !== "all") {
      result = result.filter(i => i.severity_label === filterSeverity)
    }
    if (filterStatus !== "all") {
      result = result.filter(i => i.status === filterStatus)
    }
    
    setFiltered(result)
  }, [search, incidents, filterType, filterSeverity, filterStatus])

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast.error("No data to export.")
      return
    }
    
    const headers = ["ID", "Timestamp", "Camera", "Location", "Type", "Severity", "Score", "Confidence", "Status"]
    const rows = filtered.map(i => [
      `"${i.id}"`,
      `"${format(new Date(i.created_at), 'MMM dd, yyyy HH:mm:ss')}"`,
      `"${i.camera?.name || 'Unknown'}"`,
      `"${i.camera?.location_name || 'N/A'}"`,
      `"${i.hazard_type}"`,
      `"${i.severity_label}"`,
      i.severity_score,
      `"${(i.confidence * 100).toFixed(1)}%"`,
      `"${i.status}"`
    ])
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    
    link.setAttribute("href", url)
    link.setAttribute("download", `incidents_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast.success("CSV export initiated.")
  }

  const handleExportSingle = (incident: Incident) => {
    const headers = ["Field", "Value"]
    const data = [
      ["ID", incident.id],
      ["Timestamp", format(new Date(incident.created_at), 'MMM dd, yyyy HH:mm:ss')],
      ["Camera", incident.camera?.name || 'Unknown'],
      ["Location", incident.camera?.location_name || 'N/A'],
      ["GPS", incident.latitude ? `${incident.latitude}, ${incident.longitude}` : 'N/A'],
      ["Hazard Type", incident.hazard_type],
      ["Severity Label", incident.severity_label],
      ["Severity Score", incident.severity_score],
      ["Confidence", `${(incident.confidence * 100).toFixed(1)}%`],
      ["Status", incident.status],
      ["Metadata", JSON.stringify(incident.metadata || {})]
    ]
    
    const csvContent = [headers.join(","), ...data.map(r => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `dossier_${incident.hazard_type}_${incident.id.split('-')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Incident dossier downloaded.")
  }

  const handleShare = (platform: "whatsapp" | "sms") => {
    if (!phoneNumber || phoneNumber.length < 5) {
      toast.error("Please enter a valid phone number.")
      return
    }

    let message = ""
    if (sharingContext === "all") {
      const summary = filtered.reduce((acc, curr) => {
        acc[curr.hazard_type] = (acc[curr.hazard_type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      const details = Object.entries(summary).map(([k, v]) => `${v} ${k}s`).join(", ")
      message = `🚨 DIVYADRISHTI RECAP [${format(new Date(), 'MMM dd')}]\n` +
                `Total Alerts: ${filtered.length}\n` +
                `Breakdown: ${details || 'None'}\n` +
                `View: http://localhost:3000/dashboard/incidents` 
    } else {
      const i = sharingContext as Incident
      message = `⚠️ CRITICAL ALERT [Divyadrishti]\n` +
                `TYPE: ${i.hazard_type.toUpperCase()}\n` +
                `NODE: ${i.camera?.name || 'Unknown'}\n` +
                `RISK: ${i.severity_score}/100\n` +
                `TIME: ${format(new Date(i.created_at), 'HH:mm')}\n` +
                `DASHBOARD: http://localhost:3000/dashboard/incidents/${i.id}`
    }

    const encodedMsg = encodeURIComponent(message)
    const url = platform === "whatsapp" 
      ? `https://wa.me/${phoneNumber}?text=${encodedMsg}`
      : `sms:${phoneNumber}?body=${encodedMsg}`
    
    window.open(url, '_blank')
    setIsShareModalOpen(false)
  }

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const updated = await updateIncidentStatus(id, status)
      setIncidents(prev => prev.map(i => i.id === id ? updated : i))
      toast.success(`Incident marked as ${status}`)
    } catch (err) {
      toast.error("Failed to update status")
    }
  }

  return (
    <div className="p-4 md:p-8 pt-6 h-full flex flex-col">
      <div className="flex items-center justify-between space-y-2 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Incidents Log</h2>
          <p className="text-muted-foreground mt-1">
            Complete history of all detected hazards and their resolution status.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 max-w-sm w-full relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by ID, camera, or type..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none ring-0">
              <div className="flex items-center px-4 h-9 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 shadow-sm relative cursor-pointer transition-colors text-sm font-medium">
                <SlidersHorizontal className="mr-2 h-4 w-4 text-slate-500" />
                Filters
                {(filterType !== "all" || filterSeverity !== "all" || filterStatus !== "all") && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                  </span>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xl">
              <DropdownMenuGroup className="px-1 py-1">
                <DropdownMenuLabel className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 pt-2">Hazard Type</DropdownMenuLabel>
                {["all", "pothole", "animal", "accident"].map((type) => (
                  <DropdownMenuItem 
                    key={type} 
                    onClick={() => setFilterType(type)}
                    className={`text-xs cursor-pointer capitalize ${filterType === type ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 font-bold' : ''}`}
                  >
                    {type}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
              <DropdownMenuGroup className="px-1 py-1">
                <DropdownMenuLabel className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 pt-2">Severity</DropdownMenuLabel>
                {["all", "critical", "high", "medium", "low"].map((sev) => (
                  <DropdownMenuItem 
                    key={sev} 
                    onClick={() => setFilterSeverity(sev)}
                    className={`text-xs cursor-pointer capitalize ${filterSeverity === sev ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 font-bold' : ''}`}
                  >
                    {sev}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
              <DropdownMenuGroup className="px-1 py-1">
                <DropdownMenuLabel className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 pt-2">Status</DropdownMenuLabel>
                {["all", "new", "acknowledged", "resolved"].map((st) => (
                  <DropdownMenuItem 
                    key={st} 
                    onClick={() => setFilterStatus(st)}
                    className={`text-xs cursor-pointer capitalize ${filterStatus === st ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 font-bold' : ''}`}
                  >
                    {st}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              {(filterType !== "all" || filterSeverity !== "all" || filterStatus !== "all") && (
                <>
                  <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                  <DropdownMenuItem 
                    onClick={() => { setFilterType("all"); setFilterSeverity("all"); setFilterStatus("all"); }}
                    className="text-xs cursor-pointer justify-center text-rose-500 dark:text-rose-400 font-bold hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  >
                    Reset Filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            variant="outline" 
            className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 shadow-sm"
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>

          <Button 
            className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20"
            onClick={() => { setSharingContext("all"); setIsShareModalOpen(true); }}
          >
            <MessageSquareShare className="mr-2 h-4 w-4" />
            Share Reports
          </Button>
        </div>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-card shadow-sm flex-1 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
            <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
              <TableHead className="w-[120px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Hazard Type</TableHead>
              <TableHead className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Location / Camera</TableHead>
              <TableHead className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                <div className="flex items-center cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                  Risk Level <ArrowUpDown className="ml-2 h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Status</TableHead>
              <TableHead className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                <div className="flex items-center cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                  Time Logged <ArrowUpDown className="ml-2 h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-right font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(10).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <HazardIcon type={incident.hazard_type} className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize font-medium">{incident.hazard_type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{incident.camera?.name || 'Unknown Camera'}</span>
                      <span className="text-xs text-muted-foreground">{incident.camera?.location_name || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <SeverityBadge severity={incident.severity_label} />
                    <span className="text-xs text-muted-foreground ml-2">({incident.severity_score}/100)</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={incident.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{format(new Date(incident.created_at), 'MMM d, yyyy')}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(incident.created_at), 'HH:mm:ss')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-2 hover:bg-primary/10 hover:text-primary rounded-md transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-xl">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 py-1.5 font-bold">Manage Incident</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                          <DropdownMenuItem onClick={() => handleStatusUpdate(incident.id, 'new')} className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                            <AlertTriangle className="mr-2 h-3.5 w-3.5 text-amber-500" /> Mark as New
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusUpdate(incident.id, 'assigned')} className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                            <Clock className="mr-2 h-3.5 w-3.5 text-blue-500" /> Assign Units
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusUpdate(incident.id, 'in-progress')} className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                            <Hammer className="mr-2 h-3.5 w-3.5 text-orange-500" /> In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusUpdate(incident.id, 'resolved')} className="text-xs hover:bg-emerald-50 dark:hover:bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer">
                            <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Mark Resolved
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                        <DropdownMenuItem onClick={() => handleExportSingle(incident)} className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                          Download Dossier (CSV)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSharingContext(incident); setIsShareModalOpen(true); }} className="text-xs hover:bg-orange-50 dark:hover:bg-orange-500/10 text-orange-600 dark:text-orange-400 cursor-pointer font-medium">
                          Share via Message
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                        <Link href={`/dashboard/incidents/${incident.id}`}>
                          <DropdownMenuItem className="text-xs hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-700 dark:hover:text-orange-400 cursor-pointer">
                            View Full Dossier
                          </DropdownMenuItem>
                        </Link>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Share Modal */}
      <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 p-0 overflow-hidden shadow-2xl">
          <div className="bg-orange-600 dark:bg-orange-900/40 p-6 text-white relative">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <MessageSquareShare className="h-6 w-6" />
                Share Analysis
              </DialogTitle>
              <DialogDescription className="text-orange-100 dark:text-orange-300 opacity-90 mt-1">
                {sharingContext === "all" 
                  ? `Sending a recap of ${filtered.length} active incidents.`
                  : `Sharing a detailed alert for node ${(sharingContext as Incident).camera?.name || 'Unknown'}.`}
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Recipient Phone Number</Label>
              <Input 
                id="phone" 
                placeholder="e.g. 911234567890" 
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-orange-500"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Include country code without + (e.g. 91 for India).</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pb-2 text-center text-xs font-bold">
               <div className="flex flex-col gap-2">
                 <Button onClick={() => handleShare("whatsapp")} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full shadow-lg shadow-emerald-500/20">
                   WhatsApp
                 </Button>
               </div>
               <div className="flex flex-col gap-2">
                 <Button onClick={() => handleShare("sms")} variant="outline" className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 w-full shadow-sm">
                   Android Message
                 </Button>
               </div>
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <button 
              onClick={() => setIsShareModalOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default function IncidentsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <IncidentsPageContent />
    </Suspense>
  )
}
