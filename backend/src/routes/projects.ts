import { Router } from 'express'
import { pool } from '../db'

const router = Router()

// List all projects (latest first)
router.get('/projects', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, updated_at, created_at
       FROM video_projects
       ORDER BY updated_at DESC`,
    )
    res.json({ projects: result.rows })
  } catch (err) {
    console.error('Error al listar proyectos:', err)
    res.status(500).json({ error: 'Error al listar proyectos' })
  }
})

// Get a single project (full config)
router.get('/projects/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, config, updated_at, created_at FROM video_projects WHERE id = $1`,
      [req.params.id],
    )
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Proyecto no encontrado' })
      return
    }
    res.json({ project: result.rows[0] })
  } catch (err) {
    console.error('Error al cargar proyecto:', err)
    res.status(500).json({ error: 'Error al cargar proyecto' })
  }
})

// Create a new project
router.post('/projects', async (req, res) => {
  const { name, config } = req.body
  if (!name || !config) {
    res.status(400).json({ error: 'name y config son obligatorios' })
    return
  }
  try {
    const result = await pool.query(
      `INSERT INTO video_projects (name, config) VALUES ($1, $2) RETURNING id, name, created_at, updated_at`,
      [name, JSON.stringify(config)],
    )
    res.json({ project: result.rows[0] })
  } catch (err) {
    console.error('Error al guardar proyecto:', err)
    res.status(500).json({ error: 'Error al guardar proyecto' })
  }
})

// Update an existing project
router.put('/projects/:id', async (req, res) => {
  const { name, config } = req.body
  if (!config) {
    res.status(400).json({ error: 'config es obligatorio' })
    return
  }
  try {
    const result = await pool.query(
      `UPDATE video_projects
       SET name = COALESCE($1, name), config = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, updated_at`,
      [name ?? null, JSON.stringify(config), req.params.id],
    )
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Proyecto no encontrado' })
      return
    }
    res.json({ project: result.rows[0] })
  } catch (err) {
    console.error('Error al actualizar proyecto:', err)
    res.status(500).json({ error: 'Error al actualizar proyecto' })
  }
})

// Delete a project
router.delete('/projects/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM video_projects WHERE id = $1`, [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar proyecto:', err)
    res.status(500).json({ error: 'Error al eliminar proyecto' })
  }
})

export { router as projectsRouter }
