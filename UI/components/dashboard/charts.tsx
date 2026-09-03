import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts"
import { AnalyticsSummary } from "@/lib/types"
import { getAnalyticsSummary } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"

import { useTheme } from "next-themes"

// Vibrant, high-contrast colors
const CHART_COLORS = {
  pothole:  "#f59e0b",  // Amber
  animal:   "#6366f1",  // Indigo
  accident: "#e11d48",  // Rose
  low:      "#10b981",  // Emerald
  medium:   "#f59e0b",  // Amber
  high:     "#e11d48",  // Rose
  critical: "#9f1239",  // Deep Rose
}

import { wsService } from "@/lib/websocket"

export function AnalyticsCharts() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const { theme } = useTheme()
  const isDark = theme === "dark"

  const AXIS_COLOR = isDark ? "#475569" : "#94a3b8"   // slate-600 vs slate-400
  const GRID_COLOR = isDark ? "#1e293b" : "#f1f5f9"   // slate-800 vs slate-100

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? "#0f172a" : "#ffffff", // slate-950 vs white
      border: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
      borderRadius: "10px",
      boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.4)" : "0 4px 16px rgba(0,0,0,0.08)",
      fontSize: "13px",
      fontWeight: 600,
    },
    itemStyle: { color: isDark ? "#e2e8f0" : "#1e293b" },
    labelStyle: { color: isDark ? "#94a3b8" : "#64748b", fontWeight: 500 },
  }

  useEffect(() => {
    const fetchData = () => {
      getAnalyticsSummary().then(setData).catch(console.error)
    }
    fetchData()

    wsService.connect()
    const handleAlert = () => {
      fetchData()
    }
    wsService.subscribeToAlerts(handleAlert)

    return () => {
      wsService.unsubscribeFromAlerts()
    }
  }, [])

  if (!data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
        <Skeleton className="col-span-1 lg:col-span-2 h-[260px] rounded-xl bg-slate-100" />
        <Skeleton className="h-[220px] rounded-xl bg-slate-100" />
        <Skeleton className="h-[220px] rounded-xl bg-slate-100" />
      </div>
    )
  }

  const hourlyData = data.hourly_breakdown.map(d => ({
    name: `${d.hour}:00`,
    Detections: d.count
  }))

  const typeData = [
    { name: "Pothole", value: data.by_type.pothole, fill: CHART_COLORS.pothole },
    { name: "Animal",  value: data.by_type.animal,  fill: CHART_COLORS.animal  },
    { name: "Accident",value: data.by_type.accident, fill: CHART_COLORS.accident},
  ]

  const severityData = [
    { name: "Low",      value: data.by_severity.low,      fill: CHART_COLORS.low      },
    { name: "Medium",   value: data.by_severity.medium,   fill: CHART_COLORS.medium   },
    { name: "High",     value: data.by_severity.high,     fill: CHART_COLORS.high     },
    { name: "Critical", value: data.by_severity.critical, fill: CHART_COLORS.critical },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full pb-4">

      {/* ── Line Chart ─ Detections Today ── */}
      <Card className="col-span-1 lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-2 pt-5 px-6">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Detections Today</CardTitle>
          <CardDescription className="text-slate-400 dark:text-slate-500 text-xs">Hourly breakdown of all recorded road hazards</CardDescription>
        </CardHeader>
        <CardContent className="h-[220px] px-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hourlyData} margin={{ top: 8, right: 24, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
              <XAxis
                dataKey="name"
                stroke={AXIS_COLOR}
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke={AXIS_COLOR}
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip {...tooltipStyle} />
              <Line
                type="monotone"
                dataKey="Detections"
                stroke={CHART_COLORS.animal}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: CHART_COLORS.animal, stroke: "#fff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Bar Chart ─ By Hazard Type ── */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-2 pt-5 px-6">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">By Hazard Type</CardTitle>
        </CardHeader>
        <CardContent className="h-[190px] px-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={typeData} margin={{ top: 4, right: 16, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
              <XAxis
                dataKey="name"
                stroke={AXIS_COLOR}
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={AXIS_COLOR}
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={28}
              />
              <Tooltip {...tooltipStyle} cursor={{ fill: isDark ? "#1e293b" : "#f8fafc" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {typeData.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Pie Chart ─ By Severity ── */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-2 pt-5 px-6">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">By Severity</CardTitle>
        </CardHeader>
        <CardContent className="h-[190px] px-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip {...tooltipStyle} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px", color: isDark ? "#94a3b8" : "#64748b" }}
              />
              <Pie
                data={severityData}
                cx="40%"
                innerRadius={52}
                outerRadius={76}
                paddingAngle={3}
                dataKey="value"
              >
                {severityData.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={entry.fill} stroke="transparent" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

    </div>
  )
}
