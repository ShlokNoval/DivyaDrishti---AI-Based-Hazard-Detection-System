import { useEffect, useRef, useState } from "react"
import { wsService } from "@/lib/websocket"
import { AnnotatedFrameResponse } from "@/lib/types"

interface VideoPlayerProps {
  file: File | null
  isLive?: boolean
}

export function VideoPlayer({ file, isLive = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [fps, setFps] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
  useEffect(() => {
    let objectUrl: string | null = null
    
    if (file) {
      objectUrl = URL.createObjectURL(file)
      if (videoRef.current) {
        const video = videoRef.current
        video.src = objectUrl
        video.load()
        const playPromise = video.play()
        
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            if (e.name !== 'AbortError') {
              console.warn("Autoplay skipped or failed:", e)
            }
          })
        }
      }
    }
    
    // Connect WebSocket and track status
    wsService.connect()
    const unsubStatus = wsService.onStatusChange(setWsConnected)
    setWsConnected(wsService.isConnected())

    const handleFrame = (response: AnnotatedFrameResponse) => {
      setAnnotatedFrame(response.annotatedFrame)
      
      // Calculate FPS
      frameCountRef.current++
      const now = Date.now()
      if (now - lastTimeRef.current >= 1000) {
        setFps(frameCountRef.current)
        frameCountRef.current = 0
        lastTimeRef.current = now
      }
    }

    wsService.subscribeToFrames(handleFrame)

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      wsService.unsubscribeFromFrames(handleFrame)
      unsubStatus()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [file])

  useEffect(() => {
    if (isPlaying) {
      // Use setInterval at 500ms (~2 FPS) instead of requestAnimationFrame (60 FPS).
      // This is the single biggest performance win — we only need to send a couple
      // of frames per second to the AI engine; running at 60fps just thrashes the
      // CPU with canvas draws and floods React with state updates.
      intervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
          return
        }

        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
    
        if (ctx) {
          const MAX_WIDTH = 480;
          let targetWidth = video.videoWidth;
          let targetHeight = video.videoHeight;
          if (targetWidth > MAX_WIDTH) {
            targetHeight = Math.floor(targetHeight * (MAX_WIDTH / targetWidth));
            targetWidth = MAX_WIDTH;
          }

          if (canvas.width !== targetWidth && targetWidth > 0) {
            canvas.width = targetWidth
            canvas.height = targetHeight
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      
          try {
            const base64 = canvas.toDataURL('image/jpeg', 0.35)
          
            if (base64.length < 100) {
              console.warn("Canvas failed to export image! Is the video cross-origin?")
            } else {
              wsService.sendFrame(base64, video.currentTime, undefined, 'upload')
            }
          } catch (err) {
            console.warn("CORS/Tainted Canvas Error:", err);
          }
        }

        setCurrentTime(video.currentTime)
      }, 500)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPlaying])

  return (
    <div className="relative w-full h-full flex flex-col group min-h-[400px]">
      {/* Hidden original video feed */}
      <video
        ref={videoRef}
        className="hidden"
        controls
        muted
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      
      {/* Hidden canvas for frame extraction */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Display */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {annotatedFrame ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={annotatedFrame} 
            alt="AI Annotated Frame" 
            className="absolute inset-0 w-full h-full object-contain"
          />
        ) : isLive ? (
          <div className="flex flex-col items-center gap-4 text-center px-6">
            {/* Connection status dot */}
            <div className={`w-4 h-4 rounded-full animate-pulse ${
              wsConnected ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]' : 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
            }`} />
            <div className="font-mono text-xs tracking-widest uppercase">
              <span className={wsConnected ? 'text-emerald-400' : 'text-amber-400'}>
                {wsConnected ? '[ UPLINK ACTIVE — BACKEND CONNECTED ]' : '[ CONNECTING TO BACKEND... ]'}
              </span>
            </div>
            <div className="text-white/40 font-mono text-[11px] tracking-wide leading-relaxed max-w-xs">
              {wsConnected 
                ? 'Open the ngrok URL on your phone → go to /stream → press Start Streaming'
                : 'Make sure the Node.js backend is running on port 8000'
              }
            </div>
            {wsConnected && (
              <div className="mt-2 text-emerald-500/60 font-mono text-[10px] animate-pulse">
                WAITING FOR PHONE FRAME STREAM...
              </div>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground animate-pulse font-mono text-xs tracking-widest">
            [ SENSOR_INIT_SEQUENCE_BYPASS_ACTIVE ]
          </div>
        )}
      </div>

      {/* Overlay controls and info */}
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded text-sm font-mono flex gap-4">
        <div><span className="text-white/60">FPS:</span> {fps}</div>
        <div><span className="text-white/60">TIME:</span> {currentTime.toFixed(1)}s</div>
      </div>
    </div>
  )
}
