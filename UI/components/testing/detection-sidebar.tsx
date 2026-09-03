import { useEffect, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { HazardIcon } from "@/components/shared/hazard-icon"
import { wsService } from "@/lib/websocket"
import { Detection } from "@/lib/types"
import { getSeverityColor } from "@/lib/utils"
// Removed module-level cooldown: backend deduplicates via per-type cooldowns
export function DetectionSidebar() {
  const [detections, setDetections] = useState<Detection[]>([])
  const [counts, setCounts] = useState({ pothole: 0, animal: 0, accident: 0 })

  useEffect(() => {
    const handleFrame = (response: any) => {
      if (response.detections && response.detections.length > 0) {
        setDetections(prev => {
          const updated = [...response.detections, ...prev].slice(0, 50)
          return updated
        })

        setCounts(prev => {
          const newCounts = { ...prev }
          response.detections.forEach((d: any) => {
            if (newCounts[d.class as keyof typeof newCounts] !== undefined) {
              newCounts[d.class as keyof typeof newCounts]++
            }
          })
          return newCounts
        })
      }
    };

    wsService.subscribeToFrames(handleFrame)

    return () => {
      wsService.unsubscribeFromFrames(handleFrame)
    }
  }, [])


  return (
    <div className="h-full flex flex-col pt-1">
      <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-transparent">
        <h3 className="font-mono text-sm tracking-widest text-primary flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
          DETECTION STREAM
        </h3>
        <Badge variant="outline" className="font-mono text-[10px] bg-primary/10 text-primary border-primary/30">
          {detections.length} RECORDED
        </Badge>
      </div>
      
      {/* Metrics Row */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-200 bg-slate-50 text-center py-4 text-xs">
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-slate-400 uppercase text-[9px] font-bold tracking-widest">Potholes</span>
          <span className="font-mono text-xl font-black text-amber-600">{counts.pothole}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-slate-400 uppercase text-[9px] font-bold tracking-widest">Animals</span>
          <span className="font-mono text-xl font-black text-orange-600">{counts.animal}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-slate-400 uppercase text-[9px] font-bold tracking-widest">Accidents</span>
          <span className="font-mono text-xl font-black text-red-600">{counts.accident}</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-2 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0">
        <div className="flex flex-col gap-3 pb-4 pt-3">
          {detections.map((detection, idx) => (
            <div 
              key={idx} 
              className="flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-200 hover:border-orange-300 transition-all shadow-xs hover:shadow-md animate-in fade-in slide-in-from-left-4 duration-500 relative overflow-hidden group"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-200 group-hover:bg-orange-500 transition-colors" />
              
              <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-100 shrink-0 text-orange-600">
                <HazardIcon type={detection.class as any} className="w-4 h-4" />
              </div>
              
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-black text-xs text-slate-900 uppercase tracking-wider truncate">
                    {detection.class}_DETECTED
                  </span>
                  {detection.severity && (
                    <Badge variant="outline" className={`font-mono text-[9px] px-1.5 py-0 uppercase tracking-widest border-none ${getSeverityColor(detection.severity)}`}>
                      {detection.severity}
                    </Badge>
                  )}
                </div>
                
                <div className="flex justify-between font-mono text-[10px] items-center">
                  <span className="text-orange-700 font-bold">CF: {(detection.confidence * 100).toFixed(1)}%</span>
                  <span className="text-slate-400 font-medium tracking-tight">
                    BBOX:[{detection.bbox.map(n => n.toFixed(0)).join(',')}]
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {detections.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-sm font-mono text-primary/40 animate-pulse">
              <span className="text-2xl mb-2">[-_-]</span>
              AWAITING SENSOR INITIATION...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
