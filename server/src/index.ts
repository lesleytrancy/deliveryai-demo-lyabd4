import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initStore } from './store.js'
import apiRouter from './routes/api.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT || 3001)

app.use(express.json({ limit: '5mb' }))

// CORS（dev）
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.get('/api/ping', (_req, res) => res.json({ message: 'pong', service: 'pms-server', timestamp: new Date().toISOString() }))
app.use('/api', apiRouter)

// 生产模式托管前端
const distDir = path.resolve(__dirname, '../../dist')
app.use(express.static(distDir))
app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'), err => {
    if (err) res.status(404).send('frontend not built')
  })
})

initStore()
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[pms] server running on http://localhost:${PORT}`)
})
