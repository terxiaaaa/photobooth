import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const STORAGE_KEY = 'couple_photobooth_mock_rooms'
function getRooms(): Record<string, any> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveRooms(rooms: Record<string, any>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms))
  } catch (e) {
    console.error('Failed to save rooms to localStorage', e)
  }
}

const channelName = 'couple-photobooth-realtime'
let bc: BroadcastChannel | null = null
try {
  bc = new BroadcastChannel(channelName)
} catch (e) {
  console.warn('BroadcastChannel not supported/allowed, real-time sync across tabs might be limited.', e)
}

const subscribers = new Set<(payload: { new: any }) => void>()

if (bc) {
  bc.onmessage = (event) => {
    if (event.data && event.data.type === 'UPDATE') {
      subscribers.forEach(cb => cb({ new: event.data.payload }))
    }
  }
}

class MockChannel {
  constructor(_name: string) {}
  on(event: string, _filter: any, callback: (payload: any) => void) {
    if (event === 'postgres_changes') {
      subscribers.add(callback)
    }
    return this
  }
  subscribe() {
    return this
  }
}

const mockSupabase = {
  channel(name: string) {
    return new MockChannel(name)
  },
  removeChannel(_channel: any) {
  },
  from(_table: string) {
    return {
      insert: async (data: any) => {
        const rooms = getRooms()
        rooms[data.code] = { ...data }
        saveRooms(rooms)
        if (bc) {
          bc.postMessage({ type: 'UPDATE', payload: data })
        }
        return { data, error: null }
      },
      select: () => ({
        eq: (_field: string, val: any) => ({
          single: async () => {
            const rooms = getRooms()
            const r = rooms[val]
            if (r) {
              return { data: { ...r }, error: null }
            }
            return { data: null, error: { message: 'Room not found' } }
          }
        })
      }),
      update: (updateData: any) => ({
        eq: (_field: string, code: any) => {
          const rooms = getRooms()
          const r = rooms[code]
          if (r) {
            const next = { ...r, ...updateData }
            rooms[code] = next
            saveRooms(rooms)
            if (bc) {
              bc.postMessage({ type: 'UPDATE', payload: next })
            }
            subscribers.forEach(cb => cb({ new: next }))
            return {
              select: () => ({
                single: async () => ({ data: next, error: null })
              })
            }
          }
          return {
            select: () => ({
              single: async () => ({ data: null, error: { message: 'Room not found' } })
            })
          }
        }
      })
    }
  }
}

const hasSupabaseKeys = typeof url === 'string' && url.length > 0 && typeof key === 'string' && key.length > 0

export const isMockMode = !hasSupabaseKeys

export const supabase = hasSupabaseKeys ? createClient(url, key) : (mockSupabase as any)
