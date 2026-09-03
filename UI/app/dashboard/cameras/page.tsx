"use client"

import { useEffect, useState } from "react"
import { getCameras } from "@/lib/api"
import { Camera } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Camera as CameraIcon, Plus, Video, MapPin, MoreVertical } from "lucide-react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"

export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const router = useRouter()

  useEffect(() => {
    getCameras().then(setCameras).catch(console.error)
  }, [])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Camera Registry</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage CCTV nodes and integration endpoints.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Camera
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cameras.map(camera => (
          <Card key={camera.id} className="overflow-hidden flex flex-col transition-colors border-border hover:border-primary/50 relative">
            <div className="h-32 bg-muted/40 border-b flex items-center justify-center relative overflow-hidden">
             
              {camera.active ? (
                 <div className="absolute inset-0 bg-primary/5 flex items-center justify-center">
                   <Video className="w-12 h-12 text-primary/30" />
                 </div>
              ) : (
                <div className="absolute inset-0 bg-destructive/5 flex items-center justify-center">
                   <Video className="w-12 h-12 text-destructive/30" />
                   <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center">
                     <Badge variant="destructive">NO SIGNAL</Badge>
                   </div>
                 </div>
              )}
            </div>
            
            <CardHeader className="pb-2 flex flex-row items-center justify-between w-full">
              <div className="flex flex-col gap-1 w-[80%]">
                <CardTitle className="text-lg truncate">{camera.name}</CardTitle>
                <div className="flex items-center text-xs text-muted-foreground gap-1">
                  <MapPin className="w-3 h-3" />
                  {camera.location_name}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-2 flex-col gap-3">
               <div className="flex items-center justify-between mt-2 text-xs">
                 <span className="text-muted-foreground">Status:</span>
                 <Badge variant={camera.active ? "default" : "destructive"} className={camera.active ? "bg-green-500/20 text-green-500 hover:bg-green-500/20 shadow-none border border-green-500/30 font-medium" : ""}>
                   {camera.active ? "Online" : "Offline / Disabled"}
                 </Badge>
               </div>
               
               <div className="flex items-center justify-between mt-2 text-xs">
                 <span className="text-muted-foreground">RTSP URL:</span>
                 <span className="font-mono bg-muted px-2 py-0.5 rounded text-[10px] truncate max-w-[150px]">
                   {camera.rtsp_url || "Hidden / Direct UDP"}
                 </span>
               </div>
               
               <div className="flex items-center justify-between mt-2 text-xs">
                 <span className="text-muted-foreground">Added:</span>
                 <span>{format(new Date(camera.created_at), 'MMM d, yyyy')}</span>
               </div>
               
               <div className="grid grid-cols-2 gap-2 mt-5">
                 <Button
                   variant="outline"
                   size="sm"
                   className="w-full text-xs h-8"
                   disabled={!camera.active}
                   onClick={() => router.push('/testing?mode=live')}
                 >
                   Live View
                 </Button>
                 <Button variant="secondary" size="sm" className="w-full text-xs h-8">History</Button>
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
