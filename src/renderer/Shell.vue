<template>
  <div class="shell">
    <nav class="games" role="tablist" :aria-label="t.games">
      <button v-for="g of GAMES" :key="g.id" type="button" role="tab" :aria-selected="active === g.id"
              :class="{ on: active === g.id }" @click="select(g.id)">{{ t[g.id] }}</button>
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

const GAMES = [{ id: 'genshin' }, { id: 'starrail' }, { id: 'zzz' }]
const zh = /^zh/i.test(navigator.language)
const t = zh
  ? { games: '游戏', genshin: '原神', starrail: '崩坏：星穹铁道', zzz: '绝区零', title: '米哈游抽卡记录导出' }
  : { games: 'Games', genshin: 'Genshin Impact', starrail: 'Honkai: Star Rail', zzz: 'Zenless Zone Zero', title: 'HoYo Gacha Export' }

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
.games button { padding: 8px 14px; border: 0; border-bottom: 2px solid transparent; background: none; font-size: 14px; color: #606266; cursor: pointer }
.games button:hover { color: #303133 }
.games button.on { color: #303133; font-weight: 600; border-bottom-color: #409eff }
.games button:focus-visible { outline: 2px solid #409eff; outline-offset: -2px }
</style>
