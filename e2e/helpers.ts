import { type Page, expect } from '@playwright/test'

// 全局注册：自动接受所有浏览器 alert/confirm/prompt，避免因重复 handler 导致
// "Cannot accept dialog which is already handled"。
function autoAcceptDialogs(page: Page) {
  // 用稳定标记避免跨 loginAs 重复绑定
  if ((page as any).__pmsAutoDialog) return
  ;(page as any).__pmsAutoDialog = true
  page.on('dialog', async d => {
    try { await d.accept() } catch { /* 已被其他 handler 处理 */ }
  })
}

export async function loginAs(page: Page, username: string) {
  autoAcceptDialogs(page)
  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
  await page.getByPlaceholder('用户名').fill('')
  await page.getByPlaceholder('用户名').fill(username)
  await page.getByPlaceholder('密码').fill('123456')
  await page.getByRole('button', { name: '登 录' }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.locator('aside nav a').first()).toBeVisible()
}

export async function resetDemo(page: Page) {
  autoAcceptDialogs(page)
  await loginAs(page, 'admin')
  // resetDemo 自己触发的 confirm 需要被接受；上面的全局 handler 会处理
  await page.getByRole('button', { name: /重置演示/ }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('aside nav a').first()).toBeVisible()
}

export async function switchUser(page: Page, username: string) {
  await loginAs(page, username)
}

export async function navTo(page: Page, label: string) {
  const link = page.locator('aside nav a').filter({ hasText: new RegExp('^' + label + '$') }).first()
  await link.waitFor({ state: 'visible', timeout: 10000 })
  await link.click()
}

export function field(base: Page | ReturnType<Page['locator']>, labelText: string) {
  const loc = 'locator' in base ? (base as ReturnType<Page['locator']>) : (base as Page).locator('body')
  return loc.locator('label').filter({ hasText: labelText }).locator('input, select, textarea').first()
}

export async function waitForIdle(page: Page) {
  await page.waitForLoadState('networkidle')
}

export function modal(page: Page, title: string | RegExp) {
  const heading = page.getByRole('heading', { name: title, level: 3 })
  return heading.locator('xpath=ancestor::div[contains(@class,"rounded-lg shadow-xl")][1]')
}
