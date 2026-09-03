import { defineStore } from 'pinia'
import { computed } from 'vue'

const enabled = (value: string | undefined) => value === 'true'

export const useAppStore = defineStore('app', () => {
  const agentEnabled = computed(() =>
    enabled(import.meta.env.VITE_FEATURE_AGENT),
  )
  const adminEnabled = computed(() =>
    enabled(import.meta.env.VITE_FEATURE_ADMIN),
  )

  return { agentEnabled, adminEnabled }
})
