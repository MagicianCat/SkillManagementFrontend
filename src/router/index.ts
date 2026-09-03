import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import PlaceholderView from '../views/PlaceholderView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('../components/AppShell.vue'),
      children: [
        { path: '', name: 'home', component: HomeView },
        {
          path: 'skills',
          name: 'skills',
          component: PlaceholderView,
          props: { title: 'Skill 目录' },
        },
        {
          path: 'workflows',
          name: 'workflows',
          component: PlaceholderView,
          props: { title: '生命周期工作台' },
        },
        {
          path: 'admin',
          name: 'admin',
          component: PlaceholderView,
          props: { title: '管理中心' },
          meta: { adminOnly: true },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
})

export default router
