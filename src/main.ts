import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import TDesign from 'tdesign-vue-next'
import { createPinia } from 'pinia'
import 'tdesign-vue-next/es/style/index.css'
import './assets/styles/index.css'
import App from './App.vue'
import router from './router'
import { initTheme } from './utils/theme'

initTheme()
const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueQueryPlugin)
app.use(TDesign)
app.mount('#app')