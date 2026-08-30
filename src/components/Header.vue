<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, inject, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { useAppStore } from '@/stores/app'
import { buildAdminUrl, getApiAssetUrl } from '@/utils/api'

const router = useRouter()
const appStore = useAppStore()

const isScrolled = inject<ReturnType<typeof ref<boolean>>>('isScrolled', ref(false))

const siteFavicon = ref(getApiAssetUrl('favicon.ico'))

const actionButtons = computed(() => {
  const buttons = [
    {
      title: appStore.themeMode === 'auto' ? 'Auto theme' : appStore.themeMode === 'light' ? 'Light theme' : 'Dark theme',
      icon: appStore.themeMode === 'auto' ? 'icon-park-outline:dark-mode' : appStore.themeMode === 'light' ? 'icon-park-outline:sun-one' : 'icon-park-outline:moon',
      action: 'toggleTheme',
    },
  ]

  if (appStore.isLoggedIn || !appStore.hideAdminEntryWhenLoggedOut) {
    buttons.push({
      title: 'Admin',
      icon: 'icon-park-outline:setting',
      action: 'jumpToSetting',
    })
  }
  return buttons
})

function handleButtonClick(action: string, event?: MouseEvent) {
  switch (action) {
    case 'toggleTheme':
      toggleThemeWithReveal(event)
      break
    case 'jumpToSetting':
      location.href = buildAdminUrl()
      break
  }
}

// Circular clip-path reveal from the click point using the View Transitions API,
// with a graceful fallback where the API is unavailable or motion is reduced.
function toggleThemeWithReveal(event?: MouseEvent) {
  const doc = document as Document & {
    startViewTransition?: (callback: () => Promise<void> | void) => { ready: Promise<void> }
  }
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!doc.startViewTransition || prefersReducedMotion || appStore.disablePageAnimation) {
    appStore.updateThemeMode()
    return
  }

  const x = event?.clientX ?? window.innerWidth - 24
  const y = event?.clientY ?? 24
  const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

  const transition = doc.startViewTransition(async () => {
    appStore.updateThemeMode()
    await nextTick()
  })

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 450,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        },
      )
    })
    .catch(() => {})
}

const sitename = computed(() => appStore.publicSettings?.sitename || 'CF Server Monitor')
</script>

<template>
  <div
    class="transition-all duration-200 top-0 sticky z-10 border-b border-transparent"
    :class="isScrolled ? 'backdrop-blur-xl' : 'bg-transparent'"
  >
    <div class="px-4 flex-between h-14 max-w-[1280px] mx-auto">
      <div class="flex items-center gap-3 cursor-pointer" @click="router.push('/')">
        <Avatar class="size-8 rounded-none">
          <AvatarImage :src="siteFavicon" :alt="sitename" class="rounded-none" />
          <AvatarFallback>{{ sitename.slice(0, 1) }}</AvatarFallback>
        </Avatar>
        <h3 class="m-0 text-lg font-semibold">
          {{ sitename }}
        </h3>
      </div>
      <div class="flex items-center gap-2">
        <DataTooltip v-for="button in actionButtons" :key="button.action" :content="button.title" placement="left" content-class="whitespace-nowrap text-[11px] px-2">
          <Button variant="ghost" size="icon-sm" @click="handleButtonClick(button.action, $event)">
            <Icon :icon="button.icon" :width="18" :height="18" />
          </Button>
        </DataTooltip>
      </div>
    </div>
  </div>
</template>
