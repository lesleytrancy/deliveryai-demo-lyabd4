import { test, expect, type Page } from '@playwright/test'
import { loginAs, resetDemo, navTo, field, waitForIdle } from './helpers'

/**
 * 主流程端到端冒烟测试，对应 Spec §6 验收清单第一项：
 * 申请人(zhangsan)提交采购申请 → 部门负责人(lisi)审批通过 → 采购(wangwu)生成订单、选供应商、下达
 * → 仓储(sunqi)到货登记、验收合格、确认入库 → 财务(zhouba)登记发票（全匹配）→ 生成对账
 * → 发起付款申请 → dept_manager(lisi)审批付款 → 财务登记付款，看板金额更新。
 *
 * 选用金额 < 1 万，审批链只需 dept_manager 一级，便于主流程快速跑通。
 */
test.describe('采购主流程端到端（P0 冒烟）', () => {
  test.beforeAll(async ({ browser }) => {
    // 用独立 context 做一次 reset，避免其他用例影响
    const ctx = await browser.newContext()
    const p = await ctx.newPage()
    await resetDemo(p)
    await ctx.close()
  })

  test('E2E-001: 申请→审批→下单→到货验收入库→发票对账→付款 完整闭环', async ({ page }) => {
    // ---------- 1. 张三创建并提交采购申请 ----------
    await loginAs(page, 'zhangsan')
    await navTo(page, '采购申请')
    await page.getByRole('button', { name: '新建申请' }).click()

    const modal = page.getByRole('dialog').filter({ hasText: '新建采购申请' })
    await expect(modal).toBeVisible()
    await field(modal, '标题').fill('E2E 工业盐原料采购')
    // 期望到货日期：今天 + 10 天
    const arrival = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10)
    await field(modal, '期望到货日期').fill(arrival)
    await field(modal, '事由').fill('生产线原料补充，E2E 自动化测试')
    // 添加一条明细
    await modal.getByRole('button', { name: '添加明细' }).click()
    // 默认物料为「工业盐（原料）」，设置数量=1、预估单价(未税)=1000，税率 13%
    const line = modal.locator('.border-slate-200.rounded-md').first()
    await expect(line).toBeVisible()
    await line.locator('input[type="number"]').nth(0).fill('1') // 数量
    await line.locator('input[type="number"]').nth(1).fill('1000') // 预估单价(未税)
    // 合计(含税)应为 1130
    await expect(modal.getByText('¥1,130')).toBeVisible()
    // 监听 dialog 并接受（alert 提交成功等）
    page.on('dialog', d => d.accept())
    await modal.getByRole('button', { name: '提交审批' }).click()
    await waitForIdle(page)
    // 提交后跳转到申请详情页，URL 形如 /requests/:id，状态审批中
    await expect(page).toHaveURL(/#\/requests\//)
    await expect(page.getByText('审批中')).toBeVisible()

    // ---------- 2. 李四（部门负责人）审批同意 ----------
    // 先退出张三 → 登录李四
    await page.getByRole('button', { name: '' }).locator('svg') // LogOut icon button
    // 使用显式的退出按钮：Layout 中 LogOut 按钮无 aria-label，通过右侧 LogOut 图标父 button 定位
    // 简单做法：直接访问 /login 会自动登出？不会，需要点击退出按钮或清 token
    // 走「待我审批」列表时页面应显示无权限——改为通过 localStorage 清 token 更稳
    await page.evaluate(() => localStorage.removeItem('pms_token'))
    await loginAs(page, 'lisi')
    await navTo(page, '待我审批')
    // 待审批列表应出现刚才的申请
    await expect(page.getByRole('cell', { name: /E2E 工业盐原料采购/ })).toBeVisible()
    // 点击查看 → 进入详情
    await page.getByRole('link', { name: '查看' }).first().click()
    await expect(page.getByRole('button', { name: '同意' })).toBeVisible()
    page.on('dialog', d => d.accept())
    await page.getByRole('button', { name: '同意' }).click()
    await page.getByRole('dialog', { name: '审批同意' }).waitFor()
    await page.getByRole('dialog', { name: '审批同意' }).getByRole('button', { name: '确认同意' }).click()
    await expect(page.getByText('审批通过')).toBeVisible({ timeout: 10000 })

    // ---------- 3. 王五（采购专员）生成订单、选供应商、下达 ----------
    await page.evaluate(() => localStorage.removeItem('pms_token'))
    await loginAs(page, 'wangwu')
    // 审批通过的申请应在采购申请列表里，点查看 → 生成采购订单
    await navTo(page, '采购申请')
    // 将范围切换为全部，然后点查看
    await page.getByRole('cell', { name: /E2E 工业盐原料采购/ }).waitFor()
    await page.getByRole('link', { name: '查看' }).first().click()
    await expect(page.getByRole('button', { name: '生成采购订单' })).toBeVisible()
    page.on('dialog', d => d.accept())
    await page.getByRole('button', { name: '生成采购订单' }).click()
    await page.getByRole('dialog', { name: '生成采购订单' }).getByRole('button', { name: '生成订单' }).click()
    // 跳转到订单详情页
    await expect(page).toHaveURL(/#\/orders\//)
    // 选择合格供应商「四川久大盐业原料供应有限公司」
    await field(page, '供应商').selectOption({ label: '四川久大盐业原料供应有限公司' })
    await field(page, '付款条件').selectOption({ label: '月结30天' })
    // 单价已从申请估算换算为未税 1000，总额应为 1130
    await expect(page.getByText('¥1,130').first()).toBeVisible()
    page.on('dialog', d => d.accept())
    await page.getByRole('button', { name: '下达订单' }).click()
    await expect(page.getByText('已下达')).toBeVisible()

    // ---------- 4. 孙七（仓储）到货登记、验收、入库 ----------
    await page.evaluate(() => localStorage.removeItem('pms_token'))
    await loginAs(page, 'sunqi')
    await navTo(page, '到货验收')
    await page.getByRole('button', { name: '到货登记' }).click()
    const arrModal = page.getByRole('dialog').filter({ hasText: '到货登记' })
    await expect(arrModal).toBeVisible()
    // 自动带出来刚下达的订单，数量默认=订单剩余，包装情况=完好
    await expect(arrModal.getByRole('spinbutton').first()).toHaveValue('1')
    page.on('dialog', d => d.accept())
    await arrModal.getByRole('button', { name: '登记到货' }).click()
    await waitForIdle(page)
    // 列表出现 DHDJ 开头的到货单，状态=已登记或验收中，点「验收」
    await expect(page.getByText(/DHDJ-/)).toBeVisible()
    await page.getByRole('button', { name: '验收' }).click()
    const inspModal = page.getByRole('dialog').filter({ hasText: '到货验收' })
    await expect(inspModal).toBeVisible()
    // 默认合格数量=到货数量 1、不合格=0，直接提交
    await inspModal.getByRole('button', { name: '提交验收' }).click()
    await expect(page.getByText('待入库')).toBeVisible()

    // 入库
    await navTo(page, '入库')
    await expect(page.getByText('待入库到货单')).toBeVisible()
    // 待入库到货单按钮
    const pendingBtn = page.getByRole('button', { name: /DHDJ-/ }).first()
    await pendingBtn.click()
    const pwModal = page.getByRole('dialog').filter({ hasText: '确认入库' })
    await expect(pwModal).toBeVisible()
    await field(pwModal, '仓库').fill('主仓库-盐品库')
    await pwModal.getByRole('button', { name: '确认入库' }).click()
    await waitForIdle(page)
    await expect(page.getByText('已入库')).toBeVisible()

    // ---------- 5. 周八（财务）登记发票、生成对账 ----------
    await page.evaluate(() => localStorage.removeItem('pms_token'))
    await loginAs(page, 'zhouba')
    await navTo(page, '发票/对账')
    await page.getByRole('button', { name: '登记发票' }).click()
    const invModal = page.getByRole('dialog').filter({ hasText: '登记发票' })
    await expect(invModal).toBeVisible()
    // 供应商默认=第一家合格供应商；填发票号
    await field(invModal, '发票号').fill('FP-E2E-0001')
    // 明细自动按入库单行带出数量=1、单价=订单未税单价 1000、税率 13%
    await expect(invModal.getByRole('spinbutton').first()).toHaveValue('1')
    page.on('dialog', d => d.accept())
    await invModal.getByRole('button', { name: '登记并匹配' }).click()
    await waitForIdle(page)
    // 列表中发票出现，匹配结果=完全匹配
    await expect(page.getByText('FP-E2E-0001')).toBeVisible()
    await expect(page.getByText('完全匹配')).toBeVisible()
    // 生成对账
    await page.getByRole('button', { name: '生成对账' }).click()
    const recModal = page.getByRole('dialog').filter({ hasText: '生成对账单' })
    await field(recModal, '供应商').selectOption({ label: '四川久大盐业原料供应有限公司' })
    // 对账月份=当前月
    const ym = new Date().toISOString().slice(0, 7)
    await field(recModal, '对账月份').fill(ym)
    page.on('dialog', d => d.accept())
    await recModal.getByRole('button', { name: '生成' }).click()
    await waitForIdle(page)

    // ---------- 6. 发起付款申请 ----------
    await navTo(page, '付款申请')
    await page.getByRole('button', { name: '发起付款申请' }).click()
    const payModal = page.getByRole('dialog').filter({ hasText: '发起付款申请' })
    await field(payModal, '供应商').selectOption({ label: '四川久大盐业原料供应有限公司' })
    await field(payModal, '付款金额').fill('1130')
    page.on('dialog', d => d.accept())
    await payModal.getByRole('button', { name: '提交' }).click() // 页面里有两个"取消/提交"，但按可见 dialog 取最后一个 button name=提交
    await waitForIdle(page)
    // 付款申请单出现 FK- 单号，状态=pending，当前节点=部门负责人（金额 1130 ≤1万 → dept_manager）
    await expect(page.getByText(/FK-/)).toBeVisible()
    await expect(page.getByText('部门负责人')).toBeVisible()

    // ---------- 7. 李四审批付款 ----------
    await page.evaluate(() => localStorage.removeItem('pms_token'))
    await loginAs(page, 'lisi')
    await navTo(page, '待我审批')
    // 切到付款申请待审批区
    await expect(page.getByText('付款申请待审批')).toBeVisible()
    await expect(page.getByText('四川久大盐业原料供应有限公司').first()).toBeVisible()
    await page.getByRole('button', { name: '同意' }).first().click()
    await page.getByRole('dialog', { name: '同意付款' }).getByRole('button', { name: '确认同意' }).click()
    await waitForIdle(page)
    // 状态变为"待付款"
    await navTo(page, '付款申请')
    await expect(page.getByText('待付款').first()).toBeVisible({ timeout: 10000 })
    // 登记付款（财务权限，但 lisi 是 dept_manager；换 zhouba 登记）
    await page.evaluate(() => localStorage.removeItem('pms_token'))
    await loginAs(page, 'zhouba')
    await navTo(page, '付款申请')
    page.on('dialog', d => d.accept())
    await page.getByRole('button', { name: '登记付款' }).first().click()
    await waitForIdle(page)
    await expect(page.getByText('已付款')).toBeVisible()
  })
})
