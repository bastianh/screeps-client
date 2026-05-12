import { createSignal } from 'solid-js'
import { ConnectionStatus } from '~/components/ConnectionStatus.js'
import { RoomNavigator } from '~/components/RoomNavigator.js'
import { RoomViewer } from '~/components/RoomViewer.js'
import { ConsolePanel } from '~/components/ConsolePanel.js'
import { Sidebar } from '~/components/Sidebar.js'
import { StatsBar } from '~/components/StatsBar.js'

export function Dashboard() {
  const [room, setRoom] = createSignal('W1N1')
  const [shard, setShard] = createSignal('shard0')

  const [sidebarWidth, setSidebarWidth] = createSignal(260)
  const [sidebarPrevWidth, setSidebarPrevWidth] = createSignal(260)
  const [consoleHeight, setConsoleHeight] = createSignal(220)
  const [consolePrevHeight, setConsolePrevHeight] = createSignal(220)
  const [sidebarDragging, setSidebarDragging] = createSignal(false)
  const [consoleDragging, setConsoleDragging] = createSignal(false)

  const sidebarCollapsed = () => sidebarWidth() <= 32
  const consoleCollapsed = () => consoleHeight() <= 32

  const toggleSidebar = () => {
    if (sidebarWidth() > 32) {
      setSidebarPrevWidth(sidebarWidth())
      setSidebarWidth(32)
    } else {
      setSidebarWidth(sidebarPrevWidth())
    }
  }

  const toggleConsole = () => {
    if (consoleHeight() > 32) {
      setConsolePrevHeight(consoleHeight())
      setConsoleHeight(32)
    } else {
      setConsoleHeight(consolePrevHeight())
    }
  }

  const startSidebarDrag = (e: PointerEvent) => {
    e.preventDefault()
    setSidebarDragging(true)
    const startX = e.clientX
    const startWidth = sidebarWidth()

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX
      setSidebarWidth(Math.max(32, Math.min(500, startWidth - delta)))
    }

    const onUp = () => {
      setSidebarDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startConsoleDrag = (e: PointerEvent) => {
    e.preventDefault()
    setConsoleDragging(true)
    const startY = e.clientY
    const startHeight = consoleHeight()

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientY - startY
      setConsoleHeight(Math.max(32, Math.min(500, startHeight - delta)))
    }

    const onUp = () => {
      setConsoleDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleNavigate = (r: string, s: string) => {
    setRoom(r)
    setShard(s)
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        'flex-direction': 'column',
        overflow: 'hidden',
        background: '#0d1117',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', 'border-bottom': '1px solid #30363d' }}>
        <ConnectionStatus />
        <StatsBar />
      </div>

      {/* Nav */}
      <div style={{ 'border-bottom': '1px solid #30363d' }}>
        <RoomNavigator
          onNavigate={handleNavigate}
          currentRoom={room()}
          currentShard={shard()}
        />
      </div>

      {/* Main body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Center: canvas + bottom console */}
        <div
          style={{
            display: 'flex',
            'flex-direction': 'column',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {/* Canvas */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <RoomViewer room={room()} shard={shard()} />
          </div>

          {/* Bottom Console */}
          <div
            style={{
              height: `${consoleHeight()}px`,
              'border-top': '1px solid #30363d',
              transition: consoleDragging() ? 'none' : 'height 0.15s ease',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Drag handle */}
            <div
              onPointerDown={startConsoleDrag}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '4px',
                cursor: 'row-resize',
                'z-index': 10,
                background: '#21262d',
              }}
            />
            <ConsolePanel
              shard={shard()}
              isCollapsed={consoleCollapsed()}
              onToggle={toggleConsole}
            />
          </div>
        </div>

        {/* Right Sidebar */}
        <div
          style={{
            width: `${sidebarWidth()}px`,
            'border-left': '1px solid #30363d',
            transition: sidebarDragging() ? 'none' : 'width 0.15s ease',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Drag handle */}
          <div
            onPointerDown={startSidebarDrag}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '4px',
              height: '100%',
              cursor: 'col-resize',
              'z-index': 10,
              background: '#21262d',
            }}
          />
          <Sidebar
            isCollapsed={sidebarCollapsed()}
            onToggle={toggleSidebar}
          />
        </div>
      </div>
    </div>
  )
}
