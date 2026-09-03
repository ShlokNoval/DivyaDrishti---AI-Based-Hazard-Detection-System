"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, AlertCircle, Map, BarChart3, Camera as CameraIcon, Settings, Bell, Search, Menu, ShieldAlert, Sun, Moon } from "lucide-react"
import { ModeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Incident } from "@/lib/types"
import { getIncidents } from "@/lib/api"
import { formatDistanceToNow } from "date-fns"

const navItems = [
  { title: "Command Hub", href: "/dashboard", icon: LayoutDashboard },
  { title: "Active Alerts", href: "/dashboard/incidents", icon: AlertCircle },
  { title: "Geospatial Map", href: "/dashboard/map", icon: Map },
  { title: "AI Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { title: "Node Uplinks", href: "/dashboard/cameras", icon: CameraIcon },
  { title: "System Config", href: "/dashboard/settings", icon: Settings },
]

import { wsService } from "@/lib/websocket"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [globalSearch, setGlobalSearch] = useState("")
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([])

  useEffect(() => {
    const fetchRecent = () => {
      getIncidents().then(data => {
        setRecentIncidents(data.slice(0, 5))
      }).catch(console.error)
    }

    fetchRecent()

    wsService.connect()
    const handleAlert = (newAlert: Incident) => {
      setRecentIncidents(prev => [newAlert, ...prev.filter(a => a.id !== newAlert.id)].slice(0, 5))
    }

    wsService.subscribeToAlerts(handleAlert)

    return () => {
      wsService.unsubscribeFromAlerts()
    }
  }, [])

  const handleSearchSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && globalSearch.trim()) {
      router.push(`/dashboard/incidents?q=${encodeURIComponent(globalSearch)}`)
    }
  }

  const NavContent = () => (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
        return (
          <Link key={item.href} href={item.href} className="block w-full">
            <Button
              variant="ghost"
              className={`w-full justify-start rounded-lg transition-all duration-200 font-medium text-sm ${
                isActive
                  ? "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10"
              }`}
            >
              <item.icon className={`mr-3 h-4 w-4 ${isActive ? "text-orange-600 dark:text-orange-400" : "text-slate-400 dark:text-slate-500"}`} />
              {item.title}
            </Button>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 md:flex-row font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 md:flex z-10 shadow-sm">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-slate-100 dark:border-slate-800 px-6 gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 shadow-sm">
            <ShieldAlert className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-widest text-orange-700 dark:text-orange-400">DIVYADRISHTI</span>
            <span className="text-[10px] tracking-widest text-slate-400 dark:text-slate-500 font-mono">NEURAL SOC COMMAND</span>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-auto py-5 px-3">
          <p className="text-[10px] font-semibold tracking-widest text-slate-400 dark:text-slate-600 uppercase px-3 mb-3">Navigation</p>
          <NavContent />
        </div>

        {/* Status Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mesh Status</span>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">UPLINK: SECURE</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold tracking-wide text-emerald-700 dark:text-emerald-400">ONLINE</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-6 z-10 shadow-sm">
          {/* Mobile menu */}
          <div className="flex items-center gap-4 md:hidden">
            <Sheet>
              <SheetTrigger className="inline-flex items-center justify-center p-2 rounded-md hover:bg-slate-100 text-slate-600 transition-colors">
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
                <div className="flex flex-col items-center gap-4 mb-8 mt-8">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600/10 border border-orange-600/20 shadow-sm p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo.png" alt="CSN Logo" className="h-full w-full object-contain" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black tracking-tighter text-slate-900 dark:text-white leading-none">CSN SMART CITY</span>
                      <span className="text-[10px] font-bold text-orange-500 dark:text-orange-400 uppercase tracking-widest mt-1">Municipal Corp</span>
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <NavContent />
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-bold tracking-wider text-orange-700 dark:text-orange-400 text-sm">SOC ALERTS</span>
          </div>

          {/* Search */}
          <div className="hidden md:flex flex-1 max-w-md ml-2">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="Search global incident logs..."
                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 pl-9 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus-visible:ring-orange-500/50 rounded-lg"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={handleSearchSubmit}
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <ModeToggle />

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none ring-0">
                <div className="relative text-slate-500 hover:text-orange-700 hover:bg-orange-50 dark:text-slate-400 dark:hover:text-orange-300 dark:hover:bg-orange-500/10 rounded-full h-9 w-9 flex items-center justify-center cursor-pointer transition-colors shadow-sm bg-slate-50/50 dark:bg-slate-800/50">
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 border border-white dark:border-slate-800 animate-pulse" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl p-0 overflow-hidden">
                <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Recent SOC Alerts</span>
                  <Link href="/dashboard/incidents" className="text-[10px] text-orange-600 dark:text-orange-400 font-bold hover:underline">VIEW ALL</Link>
                </div>
                <div className="max-h-[400px] overflow-auto">
                  {recentIncidents.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 italic">No recent alerts found.</div>
                  ) : (
                    recentIncidents.map((incident) => (
                      <Link key={incident.id} href={`/dashboard/incidents`}>
                        <div className="p-4 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                              incident.severity_label === 'critical' ? 'bg-rose-500' : 
                              incident.severity_label === 'high' ? 'bg-amber-500' : 'bg-blue-500'
                            }`} />
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold capitalize text-slate-900 dark:text-slate-100">{incident.hazard_type} Detected</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{incident.camera?.name || 'Unknown Node'} - {incident.camera?.location_name || 'N/A'}</span>
                              <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase mt-1">{formatDistanceToNow(new Date(incident.created_at))} ago</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
                <div className="p-2 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
                   <button className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">MARK ALL AS READ</button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className="relative h-9 w-9 rounded-full overflow-hidden outline-none ring-2 ring-orange-200 ring-offset-1 transition-all hover:ring-orange-400">
                <Avatar className="h-full w-full cursor-pointer">
                  <AvatarImage src="" alt="@admin" />
                  <AvatarFallback className="bg-orange-600 text-white font-bold text-xs">AD</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-lg" align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Authority Admin</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">ops@divyadrishti.gov</p>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                <DropdownMenuItem className="focus:bg-orange-50 dark:focus:bg-orange-500/10 focus:text-orange-700 dark:focus:text-orange-400 cursor-pointer text-slate-600 dark:text-slate-300">Auth Profile</DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-orange-50 dark:focus:bg-orange-500/10 focus:text-orange-700 dark:focus:text-orange-400 cursor-pointer text-slate-600 dark:text-slate-300">Export Global Logs</DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-rose-50 dark:focus:bg-rose-500/10 focus:text-rose-600 dark:focus:text-rose-400 cursor-pointer text-rose-600 dark:text-rose-500">Terminate Session</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-transparent w-full">
          {children}
        </main>
      </div>
    </div>
  )
}
