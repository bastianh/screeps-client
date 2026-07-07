import { createResource, createSignal, createEffect, For, Show } from 'solid-js'
import { ChevronLeft, ExternalLink, Send, X } from 'lucide-solid'
import type { ApiUserMessagesIndexResponse, ApiUserMessagesListResponse } from 'screeps-connectivity'
import { client, userInfo } from '~/stores/clientStore.js'
import { goToGame, goToProfile, goToMessages, goToMessagesUser, messagesUsername } from '~/stores/routeStore.js'
import { OverlayPage } from '~/components/OverlayPage.js'
import { PlayerBadge } from '~/components/PlayerBadge.js'
import { UserLink } from '~/components/UserLink.js'

const BORDER = '#30363d'
const TEXT = '#c9d1d9'
const MUTED = '#8b949e'
const PANEL = '#161b22'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return d.toLocaleDateString()
}

function truncate(text: string, len: number): string {
  return text.length > len ? text.slice(0, len) + '…' : text
}

type Respondent = { username: string; id: string }

function Inbox(props: { onSelect: (r: Respondent) => void }) {
  const [data] = createResource(
    () => client(),
    (c) => c.http.user.messages.index() as Promise<ApiUserMessagesIndexResponse>,
  )

  return (
    <div>
      <Show when={data.loading}>
        <div style={{ color: MUTED, padding: '24px 0', 'text-align': 'center' }}>Loading…</div>
      </Show>
      <Show when={data.error}>
        <div style={{ color: '#f85149', padding: '24px 0' }}>Failed to load messages.</div>
      </Show>
      <Show when={!data.loading && data()}>
        <Show
          when={(data()?.messages?.length ?? 0) > 0}
          fallback={
            <div style={{ color: MUTED, padding: '32px 0', 'text-align': 'center' }}>
              No messages yet. You can send a message from another player's profile page.
            </div>
          }
        >
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
            <For each={data()!.messages}>
              {(entry) => {
                const user = () => data()!.users[entry._id]
                const isUnread = () => entry.message.type === 'in' && entry.message.unread
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => props.onSelect({ username: user()?.username ?? entry._id, id: entry._id })}
                    onKeyDown={(e) => e.key === 'Enter' && props.onSelect({ username: user()?.username ?? entry._id, id: entry._id })}
                    style={{
                      display: 'flex',
                      'align-items': 'center',
                      gap: '12px',
                      padding: '12px',
                      'border-radius': '6px',
                      border: `1px solid ${isUnread() ? '#388bfd' : BORDER}`,
                      background: isUnread() ? '#0d1b2e' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <PlayerBadge badge={user()?.badge} size={32} />
                    <div style={{ flex: 1, 'min-width': 0 }}>
                      <div style={{ display: 'flex', 'align-items': 'baseline', gap: '8px', 'margin-bottom': '2px' }}>
                        <span style={{ 'font-weight': isUnread() ? 600 : 400, color: TEXT }}>{user()?.username ?? entry._id}</span>
                        <span style={{ color: MUTED, 'font-size': '12px', 'margin-left': 'auto', 'flex-shrink': 0 }}>{formatDate(entry.message.date)}</span>
                      </div>
                      <div style={{ color: MUTED, 'font-size': '13px', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>
                        <Show when={entry.message.type === 'out'}>
                          <span style={{ 'font-style': 'italic' }}>You: </span>
                        </Show>
                        {truncate(entry.message.text, 120)}
                      </div>
                    </div>
                    <Show when={isUnread()}>
                      <div style={{ width: '8px', height: '8px', 'border-radius': '50%', background: '#388bfd', 'flex-shrink': 0 }} />
                    </Show>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  )
}

function Thread(props: { respondent: Respondent; onBack: () => void }) {
  const [messages, setMessages] = createSignal<ApiUserMessagesListResponse['messages']>([])
  const [loading, setLoading] = createSignal(true)
  const [text, setText] = createSignal('')
  const [sending, setSending] = createSignal(false)

  createEffect(() => {
    const c = client()
    if (!c) return
    setLoading(true)
    void c.http.user.messages.list(props.respondent.id)
      .then((res) => setMessages(res.messages ?? []))
      .finally(() => setLoading(false))
  })

  const send = async () => {
    const c = client()
    const msg = text().trim()
    if (!c || !msg || sending()) return
    setSending(true)
    try {
      await c.http.user.messages.send(props.respondent.id, msg)
      setText('')
      const res = await c.http.user.messages.list(props.respondent.id)
      setMessages(res.messages ?? [])
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0' }}>
      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '16px' }}>
        <button
          onClick={() => props.onBack()}
          title="Back to inbox"
          style={{ display: 'flex', 'align-items': 'center', gap: '4px', padding: '5px 10px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer', 'font-size': '13px' }}
        >
          <ChevronLeft size={14} /> Inbox
        </button>
        <h2 style={{ margin: 0, 'font-size': '16px', 'font-weight': 600, color: TEXT }}>
          {props.respondent.username}
        </h2>
        <button
          onClick={() => goToProfile(props.respondent.username)}
          title="View profile"
          style={{ display: 'flex', 'align-items': 'center', gap: '4px', padding: '5px 10px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer', 'font-size': '13px', 'margin-left': 'auto' }}
        >
          Profile <ExternalLink size={12} />
        </button>
      </div>

      <Show when={loading()}>
        <div style={{ color: MUTED, padding: '24px 0', 'text-align': 'center' }}>Loading…</div>
      </Show>
      <Show when={!loading() && messages().length === 0}>
        <div style={{ color: MUTED, padding: '24px 0', 'text-align': 'center' }}>No messages yet.</div>
      </Show>
      <Show when={!loading()}>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px', 'margin-bottom': '24px' }}>
          <For each={messages()}>
            {(msg) => {
              const isOut = () => msg.type === 'out'
              return (
                <div style={{ display: 'flex', gap: '10px', 'align-items': 'flex-start' }}>
                  <div style={{ 'flex-shrink': 0, 'margin-top': '2px' }}>
                    <Show when={isOut()} fallback={<div style={{ width: '24px', height: '24px', background: PANEL, 'border-radius': '3px', border: `1px solid ${BORDER}` }} />}>
                      <PlayerBadge badge={userInfo()?.badge} size={24} />
                    </Show>
                  </div>
                  <div style={{ flex: 1, 'min-width': 0 }}>
                    <div
                      style={{
                        background: isOut() ? '#1f3158' : PANEL,
                        border: `1px solid ${isOut() ? '#388bfd33' : BORDER}`,
                        'border-radius': '6px',
                        padding: '8px 12px',
                        color: TEXT,
                        'font-size': '14px',
                        'white-space': 'pre-wrap',
                        'word-break': 'break-word',
                      }}
                    >
                      {msg.text}
                    </div>
                    <div style={{ color: MUTED, 'font-size': '11px', 'margin-top': '4px', 'text-align': isOut() ? 'right' : 'left' }}>
                      {formatDate(msg.date)}
                    </div>
                  </div>
                </div>
              )
            }}
          </For>
        </div>
      </Show>

      <div style={{ 'border-top': `1px solid ${BORDER}`, 'padding-top': '12px' }}>
        <textarea
          value={text()}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void send() } }}
          placeholder="Write a message… (Ctrl+Enter to send)"
          rows={3}
          style={{
            width: '100%',
            background: PANEL,
            border: `1px solid ${BORDER}`,
            'border-radius': '6px',
            color: TEXT,
            padding: '8px 12px',
            'font-size': '14px',
            resize: 'vertical',
            'box-sizing': 'border-box',
            'font-family': 'inherit',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-top': '8px', 'justify-content': 'flex-end' }}>
          <span style={{ color: MUTED, 'font-size': '12px' }}>Markdown supported · Ctrl+Enter to send</span>
          <button
            onClick={() => void send()}
            disabled={!text().trim() || sending()}
            style={{
              display: 'flex',
              'align-items': 'center',
              gap: '6px',
              padding: '7px 14px',
              'border-radius': '4px',
              border: 'none',
              background: !text().trim() || sending() ? '#21262d' : '#238636',
              color: !text().trim() || sending() ? MUTED : '#fff',
              cursor: !text().trim() || sending() ? 'default' : 'pointer',
              'font-size': '14px',
            }}
          >
            <Send size={14} /> Send
          </button>
        </div>
      </div>
    </div>
  )
}

export function Messages() {
  // /messages/<username> → resolve the username to a { username, id } respondent
  // (the list/send endpoints are keyed by user id). The fetcher only runs when a
  // username is present; the bare /messages inbox leaves it unresolved.
  const [respondent] = createResource(
    () => messagesUsername(),
    async (username): Promise<Respondent | null> => {
      const c = client()
      if (!c) return null
      try {
        const res = await c.http.user.find({ username })
        return res.user ? { username: res.user.username, id: res.user._id } : null
      } catch {
        return null
      }
    },
  )

  return (
    <OverlayPage maxWidth="720px">
      {/* Header — this is the player's own messaging hub, so it carries their identity. */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '10px', padding: '0 0 14px', 'border-bottom': `1px solid ${BORDER}`, 'margin-bottom': '24px' }}>
        <PlayerBadge badge={userInfo()?.badge} size={28} />
        <h1 style={{ margin: 0, 'font-size': '22px', 'font-weight': 600, color: TEXT }}>Messages</h1>
        <UserLink username={userInfo()?.username} color={MUTED} style={{ 'font-size': '14px' }} />
        <div style={{ flex: 1 }} />
        <button
          onClick={goToGame}
          title="Close"
          style={{ display: 'flex', 'align-items': 'center', padding: '7px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer' }}
        >
          <X size={16} />
        </button>
      </div>

      <Show when={messagesUsername()} fallback={<Inbox onSelect={(r) => goToMessagesUser(r.username)} />}>
        <Show when={!respondent.loading} fallback={<div style={{ color: MUTED, padding: '24px 0', 'text-align': 'center' }}>Loading…</div>}>
          <Show
            when={respondent()}
            fallback={
              <div style={{ color: MUTED, padding: '32px 0', 'text-align': 'center' }}>
                User not found.{' '}
                <span onClick={goToMessages} style={{ color: '#58a6ff', cursor: 'pointer' }}>Back to inbox</span>
              </div>
            }
          >
            <Thread respondent={respondent()!} onBack={goToMessages} />
          </Show>
        </Show>
      </Show>
    </OverlayPage>
  )
}
