import { createApp } from 'vue'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import router from '@/router/index'
import { key, store } from '@/store'
import App from './App.vue'
import i18n from '@/plugins/vue/i18n'
import contextmenuDirective from '@/common/directive/contextmenu'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@/styles/base.styl'

const app = createApp(App)

// 添加自定义指令
app.directive('contextmenu', contextmenuDirective)

// 导入 Element Plus 图标
// eslint-disable-next-line no-restricted-syntax
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// @ts-ignore
app.use(router).use(store, key).use(i18n).mount('#app')
