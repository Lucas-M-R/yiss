import { createClient } from '@supabase/supabase-js'
import type { Database } from '~~/shared/types/database.types'

let _client: ReturnType<typeof createClient<Database>> | null = null

export function useSupabaseClient() {
  if (_client) return _client
  const config = useRuntimeConfig()
  _client = createClient<Database>(
    config.public.supabaseUrl,
    config.supabaseServiceKey
  )
  return _client
}
