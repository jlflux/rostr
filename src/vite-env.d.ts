/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_KEY?: string
  readonly VITE_WORKSPACE_ID?: string
  readonly VITE_REQUIRE_LOGIN?: string
  readonly VITE_STORAGE_BUCKET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
