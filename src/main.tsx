import { render } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import './style.css'

const store = (k: string) => localStorage.getItem(k)

function App() {
  const video = useRef<HTMLVideoElement>(null)
  const [cams, setCams] = useState<MediaDeviceInfo[]>([])
  const [camId, setCamId] = useState(store('cam') ?? '')
  const [sound, setSound] = useState(store('sound') === '1')
  const [menu, setMenu] = useState(false)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')

  // Start stream whenever the selected camera changes.
  useEffect(() => {
    let stream: MediaStream | undefined
    let stopped = false
    const video_ = camId ? { deviceId: { ideal: camId } } : { facingMode: 'environment' }
    navigator.mediaDevices
      .getUserMedia({ video: video_, audio: true })
      .catch(() => navigator.mediaDevices.getUserMedia({ video: video_ })) // mic denied: video only
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        video.current!.srcObject = s
        setError('')
        // Labels are only available after permission is granted.
        const devices = await navigator.mediaDevices.enumerateDevices()
        setCams(devices.filter((d) => d.kind === 'videoinput'))
      })
      .catch((e) => setError(String(e.message ?? e)))
    return () => {
      stopped = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [camId])

  // Sound: element starts muted so autoplay is allowed; unmute only on user choice.
  useEffect(() => {
    const v = video.current!
    v.muted = !sound
    v.play().catch(() => setSound(false))
    localStorage.setItem('sound', sound ? '1' : '0')
  }, [sound])

  // Keep screen awake; the lock is released when the tab is hidden, so re-request.
  useEffect(() => {
    let lock: WakeLockSentinel | undefined
    const acquire = () =>
      document.visibilityState === 'visible' &&
      navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      document.removeEventListener('visibilitychange', acquire)
      lock?.release()
    }
  }, [])

  const pickCam = (id: string) => {
    localStorage.setItem('cam', id)
    setCamId(id)
  }

  // Lock freezes the current orientation; works in installed/fullscreen PWA on Android (not iOS).
  const toggleLock = async () => {
    const o = screen.orientation as any
    try {
      if (locked) o.unlock()
      else await o.lock(o.type)
      setLocked(!locked)
    } catch (e: any) {
      setError(`Orientation lock unsupported: ${e.message ?? e}`)
    }
  }

  return (
    <div onClick={() => setMenu(!menu)}>
      <video ref={video} autoplay playsInline muted />
      {error && <div class="msg">{error}</div>}
      {menu && (
        <div class="menu" onClick={(e) => e.stopPropagation()}>
          <select value={camId} onChange={(e) => pickCam(e.currentTarget.value)}>
            {!camId && <option value="">Default camera</option>}
            {cams.map((c, i) => (
              <option value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>
            ))}
          </select>
          <button class={sound ? 'on' : ''} onClick={() => setSound(!sound)}>
            Sound {sound ? 'on' : 'off'}
          </button>
          <button class={locked ? 'on' : ''} onClick={toggleLock}>
            Orientation {locked ? 'locked' : 'auto'}
          </button>
        </div>
      )}
    </div>
  )
}

render(<App />, document.getElementById('app')!)
