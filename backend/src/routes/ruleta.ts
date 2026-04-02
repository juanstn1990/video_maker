import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const router = Router()

const CODES_FILE = path.resolve(__dirname, '../../data/ruleta-codes.json')

interface RuletaCode {
  code: string
  used: boolean
  prize?: string
  usedAt?: string
  createdAt: string
}

interface Prize {
  id: string
  label: string
  weight: number
}

const PRIZES: Prize[] = [
  { id: 'discount10', label: '10% de descuento', weight: 2  },
  { id: 'discount20', label: '20% de descuento', weight: 2  },
  { id: 'discount30', label: '30% de descuento', weight: 82 },
  { id: 'discount40', label: '40% de descuento', weight: 5  },
  { id: 'discount50', label: '50% de descuento', weight: 5  },
  { id: 'freeSong',   label: '🎵 Canción gratis',  weight: 2  },
  { id: 'freeVideo',  label: '🎬 Video gratis',    weight: 2  },
]

const TOTAL_WEIGHT = PRIZES.reduce((acc, p) => acc + p.weight, 0)

// In-memory lock to prevent race conditions
const spinningCodes = new Set<string>()

function loadCodes(): RuletaCode[] {
  try {
    const raw = fs.readFileSync(CODES_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveCodes(codes: RuletaCode[]): void {
  fs.mkdirSync(path.dirname(CODES_FILE), { recursive: true })
  fs.writeFileSync(CODES_FILE, JSON.stringify(codes, null, 2))
}

function pickPrize(): { prize: Prize; segmentIndex: number } {
  const rnd = Math.random() * TOTAL_WEIGHT
  let acc = 0
  for (let i = 0; i < PRIZES.length; i++) {
    acc += PRIZES[i].weight
    if (rnd < acc) {
      return { prize: PRIZES[i], segmentIndex: i }
    }
  }
  // Fallback (shouldn't happen)
  return { prize: PRIZES[PRIZES.length - 1], segmentIndex: PRIZES.length - 1 }
}

// POST /api/ruleta/validate-code
router.post('/ruleta/validate-code', (req, res) => {
  const { code } = req.body as { code?: string }
  if (!code || typeof code !== 'string') {
    res.status(400).json({ valid: false, message: 'Código requerido' })
    return
  }

  const cleaned = code.trim().toUpperCase()
  const codes = loadCodes()
  const entry = codes.find(c => c.code === cleaned)

  if (!entry) {
    res.json({ valid: false, message: 'Código inválido' })
    return
  }
  if (entry.used) {
    res.json({ valid: false, message: 'Este código ya fue utilizado' })
    return
  }

  res.json({ valid: true })
})

// POST /api/ruleta/spin
router.post('/ruleta/spin', (req, res) => {
  const { code } = req.body as { code?: string }
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Código requerido' })
    return
  }

  const cleaned = code.trim().toUpperCase()

  // Lock
  if (spinningCodes.has(cleaned)) {
    res.status(409).json({ error: 'Este código ya está siendo procesado' })
    return
  }
  spinningCodes.add(cleaned)

  try {
    const codes = loadCodes()
    const idx = codes.findIndex(c => c.code === cleaned)

    if (idx === -1) {
      res.status(404).json({ error: 'Código inválido' })
      return
    }
    if (codes[idx].used) {
      res.status(409).json({ error: 'Este código ya fue utilizado' })
      return
    }

    const { prize, segmentIndex } = pickPrize()

    codes[idx].used = true
    codes[idx].prize = prize.id
    codes[idx].usedAt = new Date().toISOString()
    saveCodes(codes)

    res.json({
      prize: { id: prize.id, label: prize.label },
      segmentIndex,
    })
  } finally {
    spinningCodes.delete(cleaned)
  }
})

// POST /api/ruleta/generate-codes
router.post('/ruleta/generate-codes', (req, res) => {
  const { count, adminKey } = req.body as { count?: number; adminKey?: string }

  const expectedKey = process.env.RULETA_ADMIN_KEY
  if (!expectedKey || adminKey !== expectedKey) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }

  const n = Math.min(Math.max(1, Number(count) || 1), 500)
  const codes = loadCodes()
  const existing = new Set(codes.map(c => c.code))
  const generated: string[] = []

  let attempts = 0
  while (generated.length < n && attempts < n * 10) {
    attempts++
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    if (!existing.has(code)) {
      existing.add(code)
      generated.push(code)
      codes.push({ code, used: false, createdAt: new Date().toISOString() })
    }
  }

  saveCodes(codes)
  res.json({ codes: generated })
})

// GET /api/ruleta/codes?adminKey=...
router.get('/ruleta/codes', (req, res) => {
  const { adminKey } = req.query as { adminKey?: string }

  const expectedKey = process.env.RULETA_ADMIN_KEY
  if (!expectedKey || adminKey !== expectedKey) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }

  const codes = loadCodes()
  res.json({ codes })
})

export { router as ruletaRouter }
