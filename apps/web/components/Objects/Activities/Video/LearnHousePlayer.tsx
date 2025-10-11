import React, { useEffect, useRef, useState } from 'react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

interface VideoDetails {
  startTime?: number
  endTime?: number | null
  autoplay?: boolean
  muted?: boolean
}

interface LearnHousePlayerProps {
  src: string
  details?: VideoDetails
  onReady?: () => void
}

type VideoEventType = 'play' | 'pause' | 'seek' | 'complete' | 'rewatch' | 'progress'

interface VideoEvent {
  videoId: string
  videoTitle: string
  videoUrl: string
  eventType: VideoEventType
  currentTime: number
  duration: number
  progress: number
  btpUserId: string | null
  btpUserName: string | null
  timestamp: string
}

const LearnHousePlayer: React.FC<LearnHousePlayerProps> = ({ src, details, onReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<Plyr | null>(null)
  const [btpUserId, setBtpUserId] = useState<string | null>(null)
  const [btpUserName, setBtpUserName] = useState<string | null>(null)
  const lastProgressMilestone = useRef<number>(0)

  // Parse BTP user ID from URL parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const userId = urlParams.get('btp_user_id')
      const userName = urlParams.get('btp_user_name')

      if (userId) {
        setBtpUserId(userId)
        console.log('📊 BTP Analytics enabled for user:', userId)
      }
      if (userName) {
        setBtpUserName(userName)
      }
    }
  }, [])

  // Send video event to parent window (BTP PWA)
  const sendVideoEvent = (eventType: VideoEventType, player: Plyr) => {
    if (!player || !player.duration) return

    const progress = (player.currentTime / player.duration) * 100

    const eventData: VideoEvent = {
      videoId: src, // Using video URL as ID
      videoTitle: document.title || 'LearnHouse Video',
      videoUrl: src,
      eventType,
      currentTime: Math.floor(player.currentTime),
      duration: Math.floor(player.duration),
      progress: Math.round(progress),
      btpUserId,
      btpUserName,
      timestamp: new Date().toISOString()
    }

    // Send to parent window (BTP PWA iframe)
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'video_event',
          data: eventData
        },
        '*' // Consider restricting to specific origin in production
      )
      console.log(`📹 [BTP] Video ${eventType}:`, eventData.progress + '%', eventData)
    }
  }

  useEffect(() => {
    if (videoRef.current) {
      // Initialize Plyr
      playerRef.current = new Plyr(videoRef.current, {
        controls: [
          'play-large',
          'play',
          'progress',
          'current-time',
          'mute',
          'volume',
          'settings',
          'pip',
          'fullscreen'
        ],
        settings: ['quality', 'speed', 'loop'],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        tooltips: { controls: true, seek: true },
        keyboard: { focused: true, global: true },
        seekTime: 10,
        volume: 1,
        muted: details?.muted ?? false,
        autoplay: details?.autoplay ?? false,
        disableContextMenu: true,
        hideControls: true,
        resetOnEnd: false,
        invertTime: false,
        ratio: '16:9',
        fullscreen: { enabled: true, iosNative: true }
      })

      // Set initial time if specified
      if (details?.startTime) {
        playerRef.current.currentTime = details.startTime
      }

      // Handle end time
      if (details?.endTime) {
        playerRef.current.on('timeupdate', () => {
          if (playerRef.current && playerRef.current.currentTime >= details.endTime!) {
            playerRef.current.pause()
          }
        })
      }

      // Call onReady if provided
      if (onReady) {
        playerRef.current.on('ready', onReady)
      }

      // BTP Analytics: Video Event Listeners
      const player = playerRef.current

      // Play event
      player.on('play', () => {
        sendVideoEvent('play', player)
      })

      // Pause event
      player.on('pause', () => {
        // Only send pause if not at the end (ended will handle completion)
        if (player.currentTime < player.duration - 1) {
          sendVideoEvent('pause', player)
        }
      })

      // Seek event (when user jumps to different time)
      player.on('seeking', () => {
        sendVideoEvent('seek', player)
      })

      // Progress event (track milestones: 25%, 50%, 75%, 85%, 100%)
      player.on('timeupdate', () => {
        const progress = (player.currentTime / player.duration) * 100

        // Check for milestone progress points
        const milestones = [25, 50, 75, 85]
        for (const milestone of milestones) {
          if (progress >= milestone && lastProgressMilestone.current < milestone) {
            lastProgressMilestone.current = milestone
            sendVideoEvent('progress', player)
            break
          }
        }
      })

      // Complete event (video finished)
      player.on('ended', () => {
        sendVideoEvent('complete', player)
        lastProgressMilestone.current = 0 // Reset for rewatch
      })

      // Rewatch detection (video restarted after completion)
      player.on('loadedmetadata', () => {
        const wasCompleted = lastProgressMilestone.current >= 85
        if (wasCompleted && player.currentTime < 5) {
          sendVideoEvent('rewatch', player)
          lastProgressMilestone.current = 0
        }
      })

      // Cleanup
      return () => {
        if (playerRef.current) {
          playerRef.current.destroy()
        }
      }
    }
  }, [details, onReady, btpUserId, btpUserName])

  return (
    <div className="w-full aspect-video rounded-lg overflow-hidden">
      <style jsx global>{`
        .plyr--video {
          --plyr-color-main: #ffffff;
          --plyr-video-background: #000000;
          --plyr-menu-background: #ffffff;
          --plyr-menu-color: #000000;
          --plyr-tooltip-background: #ffffff;
          --plyr-tooltip-color: #000000;
          --plyr-range-track-height: 4px;
          --plyr-range-thumb-height: 12px;
          --plyr-range-thumb-background: #ffffff;
          --plyr-range-fill-background: #ffffff;
          --plyr-control-icon-size: 18px;
          --plyr-control-spacing: 10px;
          --plyr-control-radius: 4px;
          --plyr-video-controls-background: linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.5));
        }
        .plyr--full-ui input[type=range] {
          color: #ffffff;
        }
        .plyr__control--overlaid {
          background: rgba(255, 255, 255, 0.9);
          border: 2px solid #000;
        }
        .plyr__control--overlaid svg {
          fill: #000 !important;
        }
        .plyr__control--overlaid:hover {
          background: rgba(255, 255, 255, 1);
        }
        .plyr__control.plyr__tab-focus,
        .plyr__control:hover,
        .plyr__control[aria-expanded=true] {
          background: rgba(0, 0, 0, 0.1);
        }
        .plyr__menu__container {
          background: #ffffff;
          border: 1px solid #e5e5e5;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .plyr__menu__container > div {
          background: #ffffff;
        }
        .plyr__menu__container,
        .plyr__menu__container *,
        .plyr__menu__container button,
        .plyr__menu__container button:focus,
        .plyr__menu__container button:active,
        .plyr__menu__container button[aria-selected="true"] {
          color: #000 !important;
        }
        .plyr__menu__container button:hover {
          background: #f5f5f5;
          color: #000 !important;
        }
        .plyr__control svg {
          fill: #ffffff;
        }
        .plyr__control:hover svg {
          fill: #ffffff;
        }
        /* Settings (gear) icon: white by default, black on hover/open */
        .plyr__controls .plyr__control[data-plyr="settings"] svg {
          fill: #fff;
        }
        .plyr__controls .plyr__control[data-plyr="settings"]:hover svg,
        .plyr__controls .plyr__control[data-plyr="settings"][aria-expanded="true"] svg {
          fill: #000;
        }
        .plyr__time {
          color: #ffffff;
        }
        .plyr__progress__buffer {
          background: rgba(255, 255, 255, 0.3);
        }
        .plyr__volume--display {
          color: #ffffff;
        }
        .plyr__control[aria-expanded=true] svg {
          fill: #000000;
        }
        .plyr__control[aria-expanded=true] .plyr__tooltip {
          background: #ffffff;
          color: #000000;
        }
        .plyr__tooltip {
          background: #ffffff;
          color: #000000;
        }
        .plyr__tooltip::before {
          border-top-color: #ffffff;
        }
        /* Menu and settings icons */
        .plyr__menu__container .plyr__control svg,
        .plyr__menu__container button svg {
          fill: #000000;
        }
        .plyr__menu__container .plyr__control:hover svg,
        .plyr__menu__container button:hover svg {
          fill: #000000;
        }
        /* Settings button when menu is open */
        .plyr__control[aria-expanded=true] svg {
          fill: #000000;
        }
        /* Settings button hover */
        .plyr__control[aria-expanded=true]:hover svg {
          fill: #000000;
        }
      `}</style>
      <video
        ref={videoRef}
        className="plyr-react plyr"
        playsInline
        controls
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  )
}

export default LearnHousePlayer 