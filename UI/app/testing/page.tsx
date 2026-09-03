"use client"

import { useState } from "react"
import { VideoUploader } from "@/components/testing/video-uploader"
import { VideoPlayer } from "@/components/testing/video-player"
import { DetectionSidebar } from "@/components/testing/detection-sidebar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, MonitorPlay, Shield } from "lucide-react"
import { Suspense } from "react"

function TestingDashboardContent() {
  const searchParams = useSearchParams()
  const initialMode = searchParams.get('mode')
  
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isLive, setIsLive] = useState(initialMode === 'live')
  
  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden dark text-foreground">
      {/* Subtle Background Glows - Amber theme */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary/10 rounded-[100%] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-primary/5 rounded-[100%] blur-[100px] pointer-events-none" />
      
      <header className="border-b bg-black/40 backdrop-blur-xl px-6 py-4 flex items-center justify-between z-10 border-white/10 shadow-2xl">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="hover:bg-primary/20 hover:text-primary transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-md border border-primary/20">
              <MonitorPlay className="h-5 w-5 text-primary animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SOC Terminal <span className="text-primary">v1.2</span></h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Live Simulation Feed</p>
            </div>
          </div>
        </div>
        <div className="text-xs font-mono text-primary flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded shadow-[0_0_10px_oklch(0.65_0.15_250/20%)]">
          <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
          WS_CONNECTED
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden z-10 h-[calc(100vh-76px)]">
        <div className="flex-1 p-4 lg:p-6 flex flex-col gap-4 min-h-0">
          {!videoFile && !isLive ? (
            <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8 animate-in zoom-in-95 duration-500">
              <div className="max-w-md w-full p-px rounded-2xl bg-linear-to-b from-primary/30 to-transparent shadow-2xl shadow-primary/5">
                <div className="glass-card rounded-xl p-8 h-full flex flex-col justify-between border-white/5">
                  <VideoUploader onUpload={(file) => {
                    setVideoFile(file)
                    setIsLive(false)
                  }} />
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-2">
                <div className="w-px h-12 bg-linear-to-b from-transparent to-primary/20" />
                <div className="text-primary/40 font-black text-xl italic tracking-tighter">OR</div>
                <div className="w-px h-12 bg-linear-to-t from-transparent to-primary/20" />
              </div>

              <div className="max-w-md w-full p-px rounded-2xl bg-linear-to-b from-primary/30 to-transparent shadow-2xl shadow-primary/5">
                <div className="glass-card rounded-xl p-8 h-full flex flex-col gap-6 border-white/5">
                  <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 w-fit glow-primary">
                    <MonitorPlay className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-2xl font-black italic tracking-tighter uppercase text-white/90">Remote Node <span className="text-primary">Link</span></h3>
                      <div className="h-1 w-12 bg-primary mt-1" />
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed font-medium uppercase tracking-wide">
                      Secure uplink to high-altitude mobile sensing units via encrypted tunnel protocol.
                    </p>
                  </div>
                  <Button 
                    onClick={() => {
                      setVideoFile(null)
                      setIsLive(true)
                    }}
                    className="w-full h-14 bg-primary hover:bg-primary/80 text-black font-black uppercase tracking-[0.2em] rounded-xl shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)] transition-all active:scale-95"
                  >
                    IDENTIFY NODE
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4 animate-in fade-in duration-700">
              <div className="flex items-center justify-between">
                <h2 className="text-sm uppercase tracking-widest text-primary font-mono flex items-center gap-2">
                  <span className="w-2 h-6 bg-primary inline-block animate-pulse" />
                  Neural Inference Engine {isLive ? "(LIVE)" : "(FILE)"}
                </h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setVideoFile(null)
                    setIsLive(false)
                  }} 
                  className="font-mono text-xs border-primary/20 hover:bg-primary/10 hover:text-primary"
                >
                  [ TERMINATE FEED ]
                </Button>
              </div>
              <div className="flex-1 rounded-lg overflow-hidden relative shadow-[0_0_30px_oklch(0.65_0.15_250/10%)] group">
                {/* Techy Corner Accents */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary z-20 pointer-events-none" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary z-20 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary z-20 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary z-20 pointer-events-none shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]" />
                
                <div className="w-full h-full relative bg-black">
                  <VideoPlayer file={videoFile} isLive={isLive} />
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="w-full lg:w-96 border-l border-white/5 bg-card/60 backdrop-blur flex flex-col relative h-full min-h-0">
          <div className="absolute inset-0">
            <DetectionSidebar />
          </div>
        </div>
      </main>
    </div>
  )
}

export default function TestingDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <TestingDashboardContent />
    </Suspense>
  )
}
