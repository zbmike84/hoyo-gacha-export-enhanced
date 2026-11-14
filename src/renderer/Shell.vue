<template>
  <div class="shell">
    <nav class="games" role="tablist" :aria-label="t.games">
      <button v-for="g of GAMES" :key="g.id" type="button" role="tab" :aria-selected="active === g.id"
              :class="{ on: active === g.id }" @click="select(g.id)">{{ t[g.id] }}</button>
      <div class="update" aria-live="polite">
        <span v-if="up.status === 'checking'" class="m">{{ t.u.checking }}</span>
        <span v-else-if="up.status === 'current'" class="m">v{{ up.current }}</span>
        <el-button v-else-if="up.status === 'available'" size="small" type="primary" plain @click="app.invoke('INSTALL_UPDATE')">{{ fmt(t.u.install, up.latest) }}</el-button>
        <span v-else-if="up.status === 'downloading' || up.status === 'installing'">{{ fmt(t.u[up.status], up.latest) }}</span>
        <el-button v-else-if="up.status === 'ready'" size="small" type="success" @click="app.invoke('RELAUNCH')">{{ fmt(t.u.ready, up.latest) }}</el-button>
        <el-button v-else-if="up.status === 'manual'" size="small" plain @click="app.invoke('OPEN_RELEASES')">{{ fmt(t.u.manual, up.latest) }}</el-button>
        <span v-else-if="up.status === 'busy'" class="m">{{ t.u.busy }}</span>
        <span v-else-if="up.status === 'failed'" class="m" :title="up.error">{{ t.u.failed }} <button type="button" class="link" @click="app.invoke('CHECK_UPDATE')">{{ t.u.retry }}</button></span>
        <el-switch v-model="autoUpdate" size="small" :active-text="t.u.auto" @change="v => app.invoke('SET_AUTO_UPDATE', v)"></el-switch>
      </div>
    </nav>
    <!-- each game mounts on first visit and keeps its state afterwards -->
    <section v-show="active === 'genshin'" role="tabpanel"><genshin-app v-if="visited.genshin"></genshin-app></section>
    <section v-show="active === 'starrail'" role="tabpanel"><star-rail-app v-if="visited.starrail"></star-rail-app></section>
    <section v-show="active === 'zzz'" role="tabpanel"><zzz-app v-if="visited.zzz"></zzz-app></section>
  </div>
</template>

<script setup>
import { reactive, ref, watchEffect } from 'vue'
// three explicit panels: a v-for over <component :is> left the panels stuck on the first game
import GenshinApp from '../games/genshin/renderer/App.vue'
import StarRailApp from '../games/starrail/renderer/App.vue'
import ZzzApp from '../games/zzz/renderer/App.vue'
import { version } from '../../package.json'
import app from './appIpc'

const GAMES = [{ id: 'genshin' }, { id: 'starrail' }, { id: 'zzz' }]
const zh = /^zh/i.test(navigator.language)
const t = zh
  ? { games: '游戏', genshin: '原神', starrail: '崩坏：星穹铁道', zzz: '绝区零', title: '米哈游抽卡记录导出',
      u: { checking: '检查更新…', install: '更新到 v{}', downloading: '正在下载 v{}…', installing: '正在安装 v{}…',
           ready: '已更新到 v{}，点击重启', manual: '有新版本 v{}，需要下载完整包', busy: '另一台电脑正在更新',
           failed: '检查更新失败', retry: '重试', auto: '自动更新' } }
  : { games: 'Games', genshin: 'Genshin Impact', starrail: 'Honkai: Star Rail', zzz: 'Zenless Zone Zero', title: 'HoYo Gacha Export',
      u: { checking: 'Checking for updates…', install: 'Update to v{}', downloading: 'Downloading v{}…', installing: 'Installing v{}…',
           ready: 'Updated to v{}, click to restart', manual: 'v{} is out: download the full package', busy: 'Another PC is updating',
           failed: 'Update check failed', retry: 'Retry', auto: 'Auto update' } }
const fmt = (s, v) => s.replace('{}', v ?? '')

// self-update state from the main process (src/main/update.js)
const up = ref({ status: 'idle', current: version })
const autoUpdate = ref(true)
app.on('UPDATE', (e, s) => { up.value = s })
app.invoke('UPDATE_STATE').then(s => { up.value = s; autoUpdate.value = s.autoUpdate }).catch(() => {})

const stored = (() => { try { return localStorage.getItem('game') } catch (e) { return null } })()
const active = ref(GAMES.some(g => g.id === stored) ? stored : 'genshin')
const visited = reactive({ [active.value]: true })
const select = id => {
  active.value = id
  visited[id] = true
  try { localStorage.setItem('game', id) } catch (e) { /* not persisted */ }
}
watchEffect(() => { document.title = `${t.title} · ${t[active.value]} - v${version}` })
</script>

<style scoped>
.games { position: sticky; top: 0; z-index: 50; display: flex; gap: 4px; margin: -16px -24px 12px; padding: 8px 24px 0; background: #fff; border-bottom: 1px solid #e4e7ed }
.games > button { padding: 8px 14px; border: 0; border-bottom: 2px solid transparent; background: none; font-size: 14px; color: #606266; cursor: pointer }
.games > button:hover { color: #303133 }
.games > button.on { color: #303133; font-weight: 600; border-bottom-color: #409eff }
.games > button:focus-visible { outline: 2px solid #409eff; outline-offset: -2px }
.update { display: flex; align-items: center; gap: 12px; margin-left: auto; padding-bottom: 6px; font-size: 12px; color: #606266 }
.update .m { color: #909399 }
.update .link { padding: 0; border: 0; background: none; color: #409eff; font-size: 12px; cursor: pointer }
</style>
