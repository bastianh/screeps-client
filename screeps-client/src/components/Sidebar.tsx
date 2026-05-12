export function Sidebar(props: { isCollapsed?: boolean; onToggle?: () => void }) {
  const handleStripClick = () => {
    props.onToggle?.()
  }

  const handleButtonClick = (e: MouseEvent) => {
    e.stopPropagation()
    props.onToggle?.()
  }

  return (
    <div
      style={{
        display: 'flex',
        'flex-direction': 'row',
        height: '100%',
        background: '#0d1117',
      }}
    >
      {/* Collapsed strip – always visible, clickable background */}
      <div
        onClick={handleStripClick}
        style={{
          width: '32px',
          height: '100%',
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'border-right': '1px solid #30363d',
          padding: '8px 0',
          cursor: 'pointer',
        }}
      >
        {props.onToggle && (
          <button
            onClick={handleButtonClick}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              'font-size': '14px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            {props.isCollapsed ? '▶' : '◀'}
          </button>
        )}
      </div>

      {/* Main content – visible when sidebar is wide enough */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          'flex-direction': 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '6px 10px',
            'border-bottom': '1px solid #30363d',
            'font-size': '12px',
            'font-weight': 600,
            color: '#8b949e',
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center',
          }}
        >
          <span>Properties</span>
          {props.onToggle && (
            <button
              onClick={handleButtonClick}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                'font-size': '11px',
                cursor: 'pointer',
              }}
            >
              Collapse
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          <div style={{ color: '#484f58', 'font-style': 'italic', 'font-size': '12px' }}>
            Room properties, object details and menus will appear here…
          </div>
        </div>
      </div>
    </div>
  )
}
