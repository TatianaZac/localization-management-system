// HTTP-шар merge перевіряє запит, а створення знімка делегує окремому сервісу.

const { mergePageVersions } = require('../services/mergeService')
const { getProjectId } = require('../utils/validation')

async function mergeVersions(req, res, next) {
  try {
    const projectId = getProjectId(req.params.projectId)
    if (!projectId) return res.status(400).json({ error: 'Некоректний ідентифікатор проєкту' })

    const result = await mergePageVersions(projectId, req.body, {
      id: req.user.id,
      name: req.user.name,
      role: req.projectRole
    })
    res.status(201).json(result)
  } catch (error) {
    next(error)
  }
}

module.exports = { mergeVersions }
