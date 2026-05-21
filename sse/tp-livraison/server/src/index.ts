import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

enum DeliveryStatus {
  confirmed = 'Commande confirmée',
  preparing = 'En préparation',
  outForDelivery = 'En cours de livraison',
  delivered = 'Livré',
}

const PROGRESS_BY_STATUS: Record<DeliveryStatus, number> = {
  [DeliveryStatus.confirmed]: 0,
  [DeliveryStatus.preparing]: 25,
  [DeliveryStatus.outForDelivery]: 75,
  [DeliveryStatus.delivered]: 100,
}

type DeliveryState = {
  item: string
  courier: string
  status: DeliveryStatus
  eta: Date
  progress: number
  finished: boolean
}

type DeliveryEvent = {
  id: number
  kind: 'incident' | 'info' | 'done'
  message: string
  createdAt: string
}

const app = new Hono()
app.use(cors({
    origin: '*',
}))
const clients = new Set<ReadableStreamDefaultController<string>>()

let nextEventId = 1

let state: DeliveryState = {
  item: 'Canard en plastique géant',
  courier: 'Jean-Michel Turbo',
  status: DeliveryStatus.confirmed,
  eta: new Date(2026, 4, 30, 12),
  progress: 0,
  finished: false,
}

const events: DeliveryEvent[] = []

function sendEvent(
  controller: ReadableStreamDefaultController<string>,
  event: string,
  data: unknown
) {
  controller.enqueue(`event: ${event}\n`)
  controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
}

function broadcast(event: string, data: unknown) {
  for (const client of clients) {
    try {
      sendEvent(client, event, data)
    } catch {
      clients.delete(client)
    }
  }
}

function pushDeliveryEvent(kind: DeliveryEvent['kind'], message: string) {
  const event: DeliveryEvent = {
    id: nextEventId++,
    kind,
    message,
    createdAt: new Date().toISOString(),
  }

  events.push(event)
  broadcast('delivery:event', event)
}

app.get('/api/delivery', (c) => {
  return c.json({
    state,
    events: events.slice(-20),
  })
})

app.patch('/api/delivery/state', async (c) => {
  const body = await c.req.json()

  const nextStatus = DeliveryStatus[String(body.status ?? state.status) as keyof typeof DeliveryStatus]
  const nextEta = new Date(body.eta ?? state.eta)
  const nextProgress = PROGRESS_BY_STATUS[nextStatus]

  state = {
    ...state,
    status: nextStatus,
    eta: nextEta,
    progress: Math.max(0, Math.min(100, nextProgress)),
    finished: nextStatus === DeliveryStatus.delivered,
  }

  broadcast('delivery:update', state)

  if (state.finished) {
    pushDeliveryEvent('done', `${state.item} a été livré par ${state.courier}.`)
  }

  return c.json(state)
})

app.post('/api/delivery/incidents', async (c) => {
  const body = await c.req.json()
  const message = String(body.message ?? '').trim()

  if (!message) {
    return c.json({ error: 'Message requis' }, 400)
  }

  pushDeliveryEvent('incident', message)
  return c.json({ ok: true }, 201)
})

app.get('/api/events', (c) => {
  const stream = new ReadableStream<string>({
    start(controller) {
      clients.add(controller)

      sendEvent(controller, 'connected', {
        message: 'Connexion SSE établie',
      })

      sendEvent(controller, 'delivery:update', state)

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(`: heartbeat\n\n`)
        } catch {
          clearInterval(heartbeat)
          clients.delete(controller)
        }
      }, 15000)

      const onAbort = () => {
        clearInterval(heartbeat)
        clients.delete(controller)
        try {
          controller.close()
        } catch {}
      }

      c.req.raw.signal.addEventListener('abort', onAbort)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
