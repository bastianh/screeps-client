import { ScreepsClient, PasswordAuth, NullStorage, SubscriptionGroup } from './screeps-connectivity/dist/index.js'

const SERVER = 'http://144.76.164.126:21025'
const EMAIL  = 'dafire+le@gmail.com'
const PASS   = 'L3tm3in123!'

async function main() {
  const client = new ScreepsClient({
    url: SERVER,
    auth: new PasswordAuth({ email: EMAIL, password: PASS }),
    storage: new NullStorage(),
  })

  await client.connect()
  console.log('✓ Connected')

  const me = await client.stores.user.me()
  console.log(`✓ User: ${me.username}`)

  // Private server — shard name is null
  const shards = await client.http.game.shards.info()
  const shard = shards.shards[0]?.name ?? null
  console.log(`✓ Shard: ${JSON.stringify(shard)}`)

  const rooms = await client.http.user.rooms(me._id)
  const roomName = rooms.rooms?.[0] ?? null
  console.log(`✓ Room: ${roomName}`)

  if (!roomName) { client.disconnect(); return }

  const group = new SubscriptionGroup()
  let updateCount = 0

  group.add(client.stores.room.subscribe(roomName, shard))
  group.add(client.stores.room.on('room:update', ({ room, gameTime, objects }) => {
    updateCount++
    const ids = Object.keys(objects)
    console.log(`✓ room:update  room=${room} tick=${gameTime} objects=${ids.length}`)
    if (updateCount >= 3) {
      group.dispose()
      client.disconnect()
      console.log('✓ Done — 3 ticks received, disconnected cleanly')
    }
  }))

  // Timeout fallback
  setTimeout(() => {
    if (updateCount === 0) {
      console.error(`✗ No room:update received after 15s (subscribed to channel: ${shard ? `room:${shard}/${roomName}` : `room:${roomName}`})`)
    }
    group.dispose()
    client.disconnect()
  }, 15_000)
}

main().catch(err => { console.error('✗ Fatal:', err); process.exit(1) })
