import { For } from 'solid-js'

export const FLAG_COLOR_OPTIONS = [
  { label: 'Red',    value: 1,  css: '#ff0000' },
  { label: 'Purple', value: 2,  css: '#800080' },
  { label: 'Blue',   value: 3,  css: '#0000ff' },
  { label: 'Cyan',   value: 4,  css: '#00ffff' },
  { label: 'Green',  value: 5,  css: '#008000' },
  { label: 'Yellow', value: 6,  css: '#ffff00' },
  { label: 'Orange', value: 7,  css: '#ffa500' },
  { label: 'Brown',  value: 8,  css: '#a52a2a' },
  { label: 'Grey',   value: 9,  css: '#808080' },
  { label: 'White',  value: 10, css: '#ffffff' },
]

interface ColorPickerProps {
  value: number
  onChange: (v: number) => void
}

export function ColorPicker(props: ColorPickerProps) {
  return (
    <div style={{ display: 'flex', gap: '5px', 'flex-wrap': 'wrap' }}>
      <For each={FLAG_COLOR_OPTIONS}>
        {(opt) => (
          <div
            title={opt.label}
            onClick={() => props.onChange(opt.value)}
            style={{
              width: '18px',
              height: '18px',
              'border-radius': '50%',
              background: opt.css,
              cursor: 'pointer',
              'flex-shrink': 0,
              'box-shadow': props.value === opt.value
                ? '0 0 0 2px #0d1117, 0 0 0 4px #c9d1d9'
                : 'none',
            }}
          />
        )}
      </For>
    </div>
  )
}
