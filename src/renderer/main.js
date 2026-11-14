import { createApp } from 'vue'
import Shell from './Shell.vue'
import './index.css'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { IconInstaller } from './utils'

const app = createApp(Shell)
// surface errors from any game's UI in the console (Vue swallows them in production builds)
app.config.errorHandler = (err, vm, info) => console.error(`[${info}]`, err && err.stack || err)
app.use(ElementPlus)
IconInstaller(app)
app.mount('#app')
