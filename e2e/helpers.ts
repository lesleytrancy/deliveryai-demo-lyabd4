import { type Page, expect, type Locator } from '@playwright/test'

/** 使用演示账号登录（密码均为 123456）。 */
export async function loginAs(page: Page, username: string) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
  // LoginPage 中用户名/密码为通用 input，用 label 关联需要显式 htmlFor，这里用 placeholder 定位
  await page.getByPlaceholder('用户名').fill(username)
  await page.getByPlaceholder('密码').fill('123456')
  await page.getByRole('button', { name: '登 录' }).click()
  await expect(page).toHaveURL(/#\/$/)
}

/** admin 重置演示数据，用例间数据隔离。 */
export async function resetDemo(page: Page) {
  await loginAs(page, 'admin')
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: /重置演示/ }).click()
  await page.waitForLoadState('networkidle')
}

/** 侧边栏导航。 */
export async function navTo(page: Page, label: string) {
  await page.getByRole('link', { name: new RegExp(label) }).first().click()
}

/** 在 Modal/Form 中按字段标签定位 input / select / textarea。Field 结构为 <label><span>label</span>{control}</label>。 */
export function field(page: Page | import('@playwright/test').Locator, labelText: string): import('@playwright/test').Locator {
  const base = page as import('@playwright/test').Locator
  // 找到包含该标签文本的 span（text-slate-600 mb-1），再取其同 label 下第一个 input/select/textarea
  return base.locator('label').filter({ has: base.locator(`span:has-text("${labelText}")`).first() }).locator('input, select, textarea').first()
}

/** 简单等待网络空闲。 */
export async function waitForIdle(page: Page) {
  await page.waitForLoadState('networkidle')
}
