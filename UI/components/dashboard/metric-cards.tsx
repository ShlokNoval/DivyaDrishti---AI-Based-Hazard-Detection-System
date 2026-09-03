import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CarFront, PawPrint, Activity, AlertCircle, Clock } from "lucide-react"
import { AnalyticsSummary } from "@/lib/types"
import { getAnalyticsSummary } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"

import { wsService } from "@/lib/websocket"

export function MetricCards() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)

  useEffect(() => {
    const fetchData = () => {
      getAnalyticsSummary().then(setData).catch(console.error)
    }
    fetchData()
    const interval = setInterval(fetchData, 4000)

    wsService.connect()
    const handleAlert = () => {
      fetchData()
    }
    wsService.subscribeToAlerts(handleAlert)

    return () => {
      clearInterval(interval)
      wsService.unsubscribeFromAlerts()
    }
  }, [])

  if (!data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array(6).fill(0).map((_, i) => (
          <Card key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20 dark:bg-slate-800" />
              <Skeleton className="h-4 w-4 dark:bg-slate-800" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1 dark:bg-slate-800" />
              <Skeleton className="h-3 w-24 dark:bg-slate-800" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
      {/* Total Detections */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group">
        <div className="absolute inset-x-0 top-0 h-1 bg-orange-500 rounded-t-lg" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Detections</CardTitle>
          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 dark:group-hover:bg-orange-500 group-hover:text-white transition-colors">
            <Activity className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">{data.total_detections}</div>
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">+20.1% baseline variation</p>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-rose-500 rounded-t-lg" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Alerts</CardTitle>
          <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 dark:group-hover:bg-rose-500 group-hover:text-white transition-colors">
            <AlertCircle className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400">
            {data.by_severity.critical + data.by_severity.high}
          </div>
          <p className="text-xs text-rose-500 dark:text-rose-400 mt-1 font-medium">Unacknowledged</p>
        </CardContent>
      </Card>

      {/* Potholes */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-amber-500 rounded-t-lg" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Potholes</CardTitle>
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 dark:group-hover:bg-amber-500 group-hover:text-white transition-colors">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">{data.by_type.pothole}</div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">+4 from yesterday</p>
        </CardContent>
      </Card>

      {/* Animals */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-orange-500 rounded-t-lg" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Animals</CardTitle>
          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 dark:group-hover:bg-orange-500 group-hover:text-white transition-colors">
            <PawPrint className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">{data.by_type.animal}</div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">-2% from last week</p>
        </CardContent>
      </Card>

      {/* Accidents */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-red-600 dark:bg-red-500 rounded-t-lg" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Accidents</CardTitle>
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 group-hover:bg-red-600 dark:group-hover:bg-red-500 group-hover:text-white transition-colors">
            <CarFront className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">{data.by_type.accident}</div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">0 reported today</p>
        </CardContent>
      </Card>

      {/* Avg Response Time */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-slate-400 dark:bg-slate-500 rounded-t-lg" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Response</CardTitle>
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-500 dark:group-hover:bg-slate-600 group-hover:text-white transition-colors">
            <Clock className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">14<span className="text-lg text-slate-400 dark:text-slate-500">m</span></div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Since acknowledged</p>
        </CardContent>
      </Card>
    </div>
  )
}
