import { useEffect, useRef, useState } from 'react'
import { supabase, isMockMode } from './supabase'
import { HeroVisual } from './components/HeroVisual'
import './App.css'

type Layout = 'vertical' | 'grid'
type Theme = 'dark' | 'light' | 'color' | 'mix'

export type StickerText = {
  id: string
  text: string
  x: number
  y: number
  rotation: number
  color: string
  size: number
}

export type Room = {
  code: string
  layout: Layout
  theme: Theme
  color1?: string
  color2?: string
  host_photos: string[]
  guest_photos: string[]
  texts?: StickerText[]
}

const frames = [0, 1, 2, 3]

function makeCode() {
  return Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
}

async function compressImage(sourceUrlOrFile: string | File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const maxDim = 600
      let w = img.width
      let h = img.height
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w)
          w = maxDim
        } else {
          w = Math.round((w * maxDim) / h)
          h = maxDim
        }
      }
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      ctx?.drawImage(img, 0, 0, w, h)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      resolve(typeof sourceUrlOrFile === 'string' ? sourceUrlOrFile : '')
    }

    if (sourceUrlOrFile instanceof File) {
      const reader = new FileReader()
      reader.onload = () => {
        img.src = reader.result as string
      }
      reader.readAsDataURL(sourceUrlOrFile)
    } else {
      img.src = sourceUrlOrFile
    }
  })
}

function App() {
  const [screen, setScreen] = useState<'home' | 'create' | 'join' | 'shoot' | 'result'>('home')
  const [layout, setLayout] = useState<Layout>('vertical')
  const [theme, setTheme] = useState<Theme>('dark')
  const [color1, setColor1] = useState('#d90429')
  const [color2, setColor2] = useState('#111115')
  
  const [room, setRoom] = useState<Room | null>(null)
  const [role, setRole] = useState<'host' | 'guest'>('host')
  const [joinCode, setJoinCode] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showProModal, setShowProModal] = useState(false)

  const [texts, setTexts] = useState<StickerText[]>([])
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null)
  const [inputStickerText, setInputStickerText] = useState('')
  const [inputStickerColor, setInputStickerColor] = useState('#ffffff')

  const fileInput = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const stripContainerRef = useRef<HTMLDivElement>(null)
  const [cameraOn, setCameraOn] = useState(false)

  useEffect(() => {
    if (!room) return
    const channel = supabase
      .channel(`room-${room.code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${room.code}` }, (payload: any) => {
        const updated = payload.new as Room
        setRoom(updated)
        if (updated.texts) setTexts(updated.texts)
        const mySyncedPhotos = role === 'host' ? updated.host_photos : updated.guest_photos
        if (mySyncedPhotos) setPhotos(mySyncedPhotos)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room, role])

  useEffect(() => () => stopCamera(), [])

  async function createRoom() {
    setBusy(true)
    setError('')
    const code = makeCode()
    const newRoom: Room = {
      code,
      layout,
      theme,
      color1,
      color2,
      host_photos: [],
      guest_photos: [],
      texts: []
    }
    const { error: insertError } = await supabase.from('rooms').insert(newRoom)
    setBusy(false)
    if (insertError) {
      setError('Tidak bisa membuat room. Cek konfigurasi database.')
      return
    }
    setRoom(newRoom)
    setRole('host')
    setPhotos([])
    setTexts([])
    setScreen('shoot')
  }

  async function joinRoom() {
    setBusy(true)
    setError('')
    const { data, error: fetchError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', joinCode.trim().toUpperCase())
      .single()
    setBusy(false)
    if (fetchError || !data) {
      setError('Kode room tidak ditemukan. Silakan cek kembali.')
      return
    }
    const r = data as Room
    setRoom(r)
    setRole('guest')
    setPhotos(r.guest_photos ?? [])
    setTexts(r.texts ?? [])
    setScreen('shoot')
  }

  async function savePhotos(nextPhotos: string[]) {
    if (!room) return
    setPhotos(nextPhotos)
    const field = role === 'host' ? 'host_photos' : 'guest_photos'
    const { data, error: updateError } = await supabase
      .from('rooms')
      .update({ [field]: nextPhotos })
      .eq('code', room.code)
      .select()
      .single()
    if (updateError) setError('Foto tersimpan lokal, gagal sinkron real-time.')
    if (data) setRoom(data as Room)
  }

  async function saveTexts(nextTexts: StickerText[]) {
    setTexts(nextTexts)
    if (!room) return
    await supabase.from('rooms').update({ texts: nextTexts }).eq('code', room.code)
  }

  async function addPhoto(file: File) {
    if (photos.length >= 4) return
    const compressed = await compressImage(file)
    savePhotos([...photos, compressed])
  }

  async function openCamera() {
    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      if (camera.current) {
        camera.current.srcObject = stream
        await camera.current.play().catch(() => {})
        setCameraOn(true)
      }
    } catch (err) {
      console.error(err)
      setError('Kamera tidak dapat diakses atau diblokir browser. Silakan gunakan tombol "Pilih foto".')
    }
  }

  function stopCamera() {
    const stream = camera.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((track) => track.stop())
    if (camera.current) camera.current.srcObject = null
    setCameraOn(false)
  }

  async function capture() {
    if (!camera.current || !canvas.current || photos.length >= 4) return
    const context = canvas.current.getContext('2d')
    const vid = camera.current
    canvas.current.width = vid.videoWidth || 640
    canvas.current.height = vid.videoHeight || 480
    if (context) {
      context.translate(canvas.current.width, 0)
      context.scale(-1, 1)
      context.drawImage(vid, 0, 0, canvas.current.width, canvas.current.height)
    }
    const rawDataUrl = canvas.current.toDataURL('image/jpeg', 0.85)
    const compressed = await compressImage(rawDataUrl)
    savePhotos([...photos, compressed])
  }

  function handleAddSticker() {
    if (!inputStickerText.trim()) return
    const newSticker: StickerText = {
      id: Math.random().toString(36).substring(2, 9),
      text: inputStickerText.trim(),
      x: 35,
      y: 82,
      rotation: 0,
      color: inputStickerColor,
      size: 14
    }
    const nextTexts = [...texts, newSticker]
    saveTexts(nextTexts)
    setSelectedStickerId(newSticker.id)
    setInputStickerText('')
  }

  function handleDeleteSticker(id: string) {
    const nextTexts = texts.filter((t) => t.id !== id)
    saveTexts(nextTexts)
    if (selectedStickerId === id) setSelectedStickerId(null)
  }

  function handleUpdateSticker(id: string, updates: Partial<StickerText>) {
    const nextTexts = texts.map((t) => (t.id === id ? { ...t, ...updates } : t))
    saveTexts(nextTexts)
  }

  function handleStickerPointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    setSelectedStickerId(id)
    const container = stripContainerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const onPointerMove = (moveEv: PointerEvent) => {
      let x = ((moveEv.clientX - rect.left) / rect.width) * 100
      let y = ((moveEv.clientY - rect.top) / rect.height) * 100
      x = Math.max(5, Math.min(95, x))
      y = Math.max(5, Math.min(95, y))
      handleUpdateSticker(id, { x, y })
    }

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  async function downloadStrip() {
    if (!room) return
    const hostPhotos = room.host_photos || []
    const guestPhotos = room.guest_photos || []
    const leftPhotos = role === 'host' ? hostPhotos : guestPhotos
    const rightPhotos = role === 'host' ? guestPhotos : hostPhotos

    const isGrid = room.layout === 'grid'
    const cvs = document.createElement('canvas')
    const w = isGrid ? 1200 : 800
    const h = isGrid ? 1600 : 2400
    cvs.width = w
    cvs.height = h
    const ctx = cvs.getContext('2d')
    if (!ctx) return

    if (room.theme === 'light') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
    } else if (room.theme === 'color') {
      const grad = ctx.createLinearGradient(0, 0, w, h)
      grad.addColorStop(0, '#f6af9d')
      grad.addColorStop(0.5, '#91a7f7')
      grad.addColorStop(1, '#eac780')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    } else if (room.theme === 'mix') {
      const grad = ctx.createLinearGradient(0, 0, w, h)
      grad.addColorStop(0, room.color1 || '#d90429')
      grad.addColorStop(1, room.color2 || '#111115')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    } else {
      ctx.fillStyle = '#1b1b20'
      ctx.fillRect(0, 0, w, h)
    }

    const loadImage = (src: string): Promise<HTMLImageElement | null> => {
      return new Promise((res) => {
        if (!src) return res(null)
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => res(img)
        img.onerror = () => res(null)
        img.src = src
      })
    }

    const drawCover = (img: HTMLImageElement, x: number, y: number, width: number, height: number) => {
      const imgRatio = img.width / img.height
      const targetRatio = width / height
      let sw = img.width
      let sh = img.height
      let sx = 0
      let sy = 0

      if (imgRatio > targetRatio) {
        sw = img.height * targetRatio
        sx = (img.width - sw) / 2
      } else {
        sh = img.width / targetRatio
        sy = (img.height - sh) / 2
      }
      ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height)
    }

    const padX = isGrid ? 40 : 40
    const gap = isGrid ? 24 : 20

    if (!isGrid) {
      const frameW = w - padX * 2
      const frameH = Math.floor((h - 220 - gap * 3) / 4)

      for (let i = 0; i < 4; i++) {
        const fy = 40 + i * (frameH + gap)
        const halfW = (frameW - 12) / 2

        ctx.fillStyle = room.theme === 'light' ? '#e8e8ed' : '#2a2a34'
        ctx.fillRect(padX, fy, frameW, frameH)

        const imgLeft = await loadImage(leftPhotos[i])
        if (imgLeft) drawCover(imgLeft, padX, fy, halfW, frameH)

        const imgRight = await loadImage(rightPhotos[i])
        if (imgRight) drawCover(imgRight, padX + halfW + 12, fy, halfW, frameH)
      }
    } else {
      const cellW = (w - padX * 2 - gap) / 2
      const cellH = (h - 220 - gap) / 2

      const gridCells = [leftPhotos[0], rightPhotos[0], leftPhotos[1], rightPhotos[1]]
      const coords = [
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 0, row: 1 },
        { col: 1, row: 1 }
      ]

      for (let i = 0; i < 4; i++) {
        const { col, row } = coords[i]
        const fx = padX + col * (cellW + gap)
        const fy = 40 + row * (cellH + gap)

        ctx.fillStyle = room.theme === 'light' ? '#e8e8ed' : '#2a2a34'
        ctx.fillRect(fx, fy, cellW, cellH)

        const img = await loadImage(gridCells[i])
        if (img) drawCover(img, fx, fy, cellW, cellH)
      }
    }

    const activeTexts = texts.length > 0 ? texts : (room.texts || [])
    activeTexts.forEach((st) => {
      ctx.save()
      const posX = (st.x / 100) * w
      const posY = (st.y / 100) * h
      ctx.translate(posX, posY)
      ctx.rotate((st.rotation * Math.PI) / 180)

      const scaledFontSize = Math.round(st.size * (w / 230))
      ctx.font = `bold ${scaledFontSize}px 'Caveat', 'DM Sans', sans-serif`
      ctx.fillStyle = st.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.shadowBlur = 6
      ctx.fillText(st.text, 0, 0)
      ctx.restore()
    })

    ctx.fillStyle = room.theme === 'light' ? '#17171b' : '#ffffff'
    ctx.font = `bold 28px 'DM Mono', monospace`
    ctx.letterSpacing = '0.12em'
    ctx.fillText(`NUVO • ROOM: ${room.code}`, padX, h - 60)

    const link = document.createElement('a')
    link.download = `nuvo-${room.code}.png`
    link.href = cvs.toDataURL('image/png')
    link.click()
  }

  if (screen === 'home') {
    return (
      <main className="landing">
        <header>
          <a className="brand" href="#home">
            Nuvo
          </a>
        </header>
        <section className="hero-wrapper">
          <div className="hero-text">
            <h1>
              Take a Pic
              <br />
              <i>with Friends!!</i>
            </h1>
            <div className="actions">
              <button onClick={() => setScreen('create')}>
                Mulai sesi <Arrow />
              </button>
              <button className="quiet" onClick={() => setScreen('join')}>
                Gabung room
              </button>
            </div>
          </div>
          <HeroVisual />
        </section>
        <footer>
          <span>Created by @terxiaaaa</span>
        </footer>
      </main>
    )
  }

  if (screen === 'create') {
    return (
      <main className="maker">
        <Back onClick={() => setScreen('home')} />
        <p className="step">01 / 02</p>
        <h2>Pilih bentuk strip</h2>
        <div className="choices">
          <button
            className={`layout-card ${layout === 'vertical' ? 'selected' : ''}`}
            onClick={() => setLayout('vertical')}
          >
            <StripIcon vertical />
            <b>1 × 4</b>
          </button>
          <button
            className={`layout-card ${layout === 'grid' ? 'selected' : ''}`}
            onClick={() => setLayout('grid')}
          >
            <StripIcon />
            <b>2 × 2</b>
          </button>
        </div>

        <p className="step second">02 / 02</p>
        <h2>Pilih warna border</h2>
        <div className="themes">
          <button
            className={`theme dark ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
          >
            <span></span>Dark
          </button>
          <button
            className={`theme light ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
          >
            <span></span>Light
          </button>
          <button
            className={`theme color ${theme === 'color' ? 'active' : ''}`}
            onClick={() => setTheme('color')}
          >
            <span></span>Rainbow
          </button>
          <button
            className={`theme mix ${theme === 'mix' ? 'active' : ''}`}
            onClick={() => setTheme('mix')}
          >
            <span></span>Campur warna
          </button>
          <button
            className="theme locked"
            onClick={() => setShowProModal(true)}
            title="Fitur Custom Image Border (PRO)"
            aria-label="Fitur Custom Image Border (PRO)"
          >
            <span>🔒</span>
          </button>
        </div>

        {theme === 'mix' && (
          <div className="mix-color-picker">
            <label>
              Warna 1:
              <input type="color" value={color1} onChange={(e) => setColor1(e.target.value)} />
            </label>
            <label>
              Warna 2:
              <input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} />
            </label>
          </div>
        )}

        {error && <p className="error">{error}</p>}
        {isMockMode && (
          <p className="error">
            Mode simulasi: isi VITE_SUPABASE_URL &amp; VITE_SUPABASE_PUBLISHABLE_KEY di .env.local
            supaya bisa terhubung antar perangkat.
          </p>
        )}
        <button className="primary next" disabled={busy} onClick={createRoom}>
          {busy ? 'Membuat room...' : 'Buat room'} <Arrow />
        </button>

        {showProModal && (
          <div className="pro-modal-overlay" onClick={() => setShowProModal(false)}>
            <div className="pro-modal" onClick={(e) => e.stopPropagation()}>
              <span className="pro-icon">🔒</span>
              <h3>Fitur Premium Pro</h3>
              <p>
                Custom Image Border hanya tersedia di <b>Nuvo Pro</b>. Tingkatkan ke paket premium untuk mengunggah gambar & motif kustom sebagai bingkai strip photo!
              </p>
              <button className="primary" onClick={() => setShowProModal(false)}>
                Mengerti
              </button>
            </div>
          </div>
        )}
      </main>
    )
  }

  if (screen === 'join') {
    return (
      <main className="join">
        <Back onClick={() => setScreen('home')} />
        <p className="eyebrow">JOIN YOUR PERSON</p>
        <h2>Masuk ke room.</h2>
        <p>Masukkan kode 6 karakter yang diberikan teman/pasanganmu.</p>
        <label htmlFor="room-code">KODE ROOM</label>
        <input
          id="room-code"
          value={joinCode}
          maxLength={6}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          placeholder="ABC123"
        />
        <button className="primary" disabled={busy || joinCode.length < 6} onClick={joinRoom}>
          {busy ? 'Mencari...' : 'Gabung sesi'} <Arrow />
        </button>
        {error && <p className="error">{error}</p>}
        {isMockMode && (
          <p className="error">
            Mode simulasi: isi VITE_SUPABASE_URL &amp; VITE_SUPABASE_PUBLISHABLE_KEY di .env.local
            supaya bisa terhubung antar perangkat.
          </p>
        )}
      </main>
    )
  }

  const partnerPhotos = role === 'host' ? room?.guest_photos ?? [] : room?.host_photos ?? []
  const leftSide = role === 'host' ? photos : partnerPhotos
  const rightSide = role === 'host' ? partnerPhotos : photos

  if (screen === 'result' && room) {
    return (
      <main className="result">
        <button className="brand" onClick={() => setScreen('shoot')}>
          Nuvo
        </button>
        <p className="eyebrow">YOUR SHARED MOMENT</p>
        <h2>Strip selesai.</h2>
        <p>Room {room.code}. Simpan kenangan ini sebelum sesi berakhir.</p>
        <Preview
          layout={room.layout}
          theme={room.theme}
          color1={room.color1}
          color2={room.color2}
          left={leftSide}
          right={rightSide}
          texts={texts}
          selectedStickerId={selectedStickerId}
          onStickerPointerDown={handleStickerPointerDown}
          onDeleteSticker={handleDeleteSticker}
          containerRef={stripContainerRef}
        />

        <div className="sticker-controls">
          <header>
            <span>STIKER & TEKS TAMBAHAN</span>
            {selectedStickerId && (
              <button className="text-button" onClick={() => setSelectedStickerId(null)}>
                Batal pilih
              </button>
            )}
          </header>
          <div className="sticker-input-group">
            <input
              type="text"
              placeholder="Tulis teks kustom..."
              value={inputStickerText}
              onChange={(e) => setInputStickerText(e.target.value)}
            />
            <input
              type="color"
              value={inputStickerColor}
              onChange={(e) => setInputStickerColor(e.target.value)}
            />
            <button className="small-button" onClick={handleAddSticker}>
              + Tambah
            </button>
          </div>

          {selectedStickerId && (
            <div className="sticker-actions-row">
              {(() => {
                const sel = texts.find((t) => t.id === selectedStickerId)
                if (!sel) return null
                return (
                  <>
                    <label>Rotasi ({sel.rotation}°):</label>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={sel.rotation}
                      onChange={(e) =>
                        handleUpdateSticker(sel.id, { rotation: parseInt(e.target.value) })
                      }
                    />
                    <label>Ukuran ({sel.size}px):</label>
                    <input
                      type="range"
                      min="10"
                      max="32"
                      value={sel.size}
                      onChange={(e) =>
                        handleUpdateSticker(sel.id, { size: parseInt(e.target.value) })
                      }
                    />
                  </>
                )
              })()}
            </div>
          )}
        </div>

        <button className="primary" onClick={downloadStrip}>
          Download PNG <Arrow />
        </button>
        <button className="text-button" onClick={() => setScreen('shoot')}>
          Kembali ke sesi
        </button>
      </main>
    )
  }

  return (
    <main className="shoot">
      <div className="shoot-top">
        <button className="brand" onClick={() => setScreen('home')}>
          Nuvo
        </button>
        <span>{role === 'host' ? 'KAMU MEMBUAT ROOM' : 'KAMU BERGABUNG KE ROOM'}</span>
        <span className="room-code">ROOM: {room?.code}</span>
      </div>
      <div className="shoot-content">
        <section className="camera-area">
          <p className="counter">{photos.length + 1} / 4</p>
          <div className="camera-box">
            <video ref={camera} className={cameraOn ? '' : 'hidden'} autoPlay playsInline muted />
            {!cameraOn && (
              <div className="camera-empty">
                <span>+</span>
                <p>Aktifkan kamera atau pilih foto</p>
              </div>
            )}
          </div>
          <canvas ref={canvas} hidden />
          <div className="camera-actions">
            {cameraOn ? (
              <>
                <button className="capture" onClick={capture} aria-label="Ambil foto"></button>
                <button className="small-button" onClick={stopCamera}>
                  Tutup kamera
                </button>
              </>
            ) : (
              <>
                <button className="primary" onClick={openCamera}>
                  Buka kamera
                </button>
                <button className="small-button" onClick={() => fileInput.current?.click()}>
                  Pilih foto
                </button>
              </>
            )}
            <input
              ref={fileInput}
              hidden
              type="file"
              accept="image/*"
              onChange={(event) => event.target.files?.[0] && addPhoto(event.target.files[0])}
            />
          </div>
          <div className="shots">
            {frames.map((index) => (
              <div className="shot" key={index}>
                {photos[index] ? <img src={photos[index]} alt={`Foto kamu ${index + 1}`} /> : `${index + 1}`}
              </div>
            ))}
          </div>
        </section>

        <aside>
          <p className="eyebrow">LIVE PREVIEW</p>
          <Preview
            layout={room?.layout ?? 'vertical'}
            theme={room?.theme ?? 'dark'}
            color1={room?.color1}
            color2={room?.color2}
            left={leftSide}
            right={rightSide}
            texts={texts}
            selectedStickerId={selectedStickerId}
            onStickerPointerDown={handleStickerPointerDown}
            onDeleteSticker={handleDeleteSticker}
            containerRef={stripContainerRef}
          />

          <p className="waiting">
            {partnerPhotos.length
              ? `Pasangan sudah mengisi ${partnerPhotos.length}/4 foto.`
              : 'Menunggu pasangan masuk dan mengisi foto.'}
          </p>

          <div className="sticker-controls">
            <header>
              <span>TAMBAH TEKS / STIKER BORDER</span>
            </header>
            <div className="sticker-input-group">
              <input
                type="text"
                placeholder="Teks border..."
                value={inputStickerText}
                onChange={(e) => setInputStickerText(e.target.value)}
              />
              <input
                type="color"
                value={inputStickerColor}
                onChange={(e) => setInputStickerColor(e.target.value)}
              />
              <button className="small-button" onClick={handleAddSticker}>
                + Tambah
              </button>
            </div>
            {selectedStickerId && (
              <div className="sticker-actions-row">
                {(() => {
                  const sel = texts.find((t) => t.id === selectedStickerId)
                  if (!sel) return null
                  return (
                    <>
                      <label>Rotasi ({sel.rotation}°):</label>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={sel.rotation}
                        onChange={(e) =>
                          handleUpdateSticker(sel.id, { rotation: parseInt(e.target.value) })
                        }
                      />
                      <label>Ukuran ({sel.size}px):</label>
                      <input
                        type="range"
                        min="10"
                        max="32"
                        value={sel.size}
                        onChange={(e) =>
                          handleUpdateSticker(sel.id, { size: parseInt(e.target.value) })
                        }
                      />
                    </>
                  )
                })()}
              </div>
            )}
          </div>

          {photos.length > 0 && (
            <button className="primary" onClick={() => setScreen('result')}>
              Lihat hasil <Arrow />
            </button>
          )}
        </aside>
      </div>
      {error && <p className="error floating">{error}</p>}
    </main>
  )
}

function Preview({
  layout,
  theme,
  color1,
  color2,
  left,
  right,
  texts = [],
  selectedStickerId,
  onStickerPointerDown,
  onDeleteSticker,
  containerRef
}: {
  layout: Layout
  theme: Theme
  color1?: string
  color2?: string
  left: string[]
  right: string[]
  texts?: StickerText[]
  selectedStickerId?: string | null
  onStickerPointerDown?: (e: React.PointerEvent, id: string) => void
  onDeleteSticker?: (id: string) => void
  containerRef?: React.RefObject<HTMLDivElement | null>
}) {
  const inlineStyle: React.CSSProperties = {}
  if (theme === 'mix') {
    inlineStyle.background = `linear-gradient(135deg, ${color1 || '#d90429'}, ${color2 || '#111115'})`
  }

  return (
    <div
      ref={containerRef}
      className={`final-strip ${layout} ${theme}`}
      style={inlineStyle}
    >
      {layout === 'grid'
        ? [left[0], right[0], left[1], right[1]].map((cell, index) => (
            <div className="strip-photo" key={index}>
              <div>{cell && <img src={cell} alt={`Foto ${index + 1}`} />}</div>
            </div>
          ))
        : frames.map((index) => (
            <div className="strip-photo" key={index}>
              <div>{left[index] && <img src={left[index]} alt="Foto user 1" />}</div>
              <div>{right[index] && <img src={right[index]} alt="Foto user 2" />}</div>
            </div>
          ))}

      {texts.map((st) => (
        <div
          key={st.id}
          className={`sticker-item ${selectedStickerId === st.id ? 'selected' : ''}`}
          style={{
            left: `${st.x}%`,
            top: `${st.y}%`,
            transform: `translate(-50%, -50%) rotate(${st.rotation}deg)`,
            color: st.color,
            fontSize: `${st.size}px`,
            fontFamily: "'Caveat', cursive, sans-serif",
            fontWeight: 'bold',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)'
          }}
          onPointerDown={(e) => onStickerPointerDown && onStickerPointerDown(e, st.id)}
        >
          {st.text}
          {selectedStickerId === st.id && onDeleteSticker && (
            <button
              className="sticker-delete"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteSticker(st.id)
              }}
              title="Hapus teks"
            >
              ×
            </button>
          )}
        </div>
      ))}

      <b className="brand-label">NUVO</b>
    </div>
  )
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  )
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button className="back" onClick={onClick}>
      <Arrow /> Kembali
    </button>
  )
}

function StripIcon({ vertical = false }: { vertical?: boolean }) {
  return (
    <span className={`strip-icon ${vertical ? 'vertical' : ''}`}>
      {frames.map((frame) => (
        <i key={frame}></i>
      ))}
    </span>
  )
}

export default App
