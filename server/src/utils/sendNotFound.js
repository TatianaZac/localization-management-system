// Цей файл містить допоміжну функцію для однакових HTTP-відповідей 404.

// Надсилає клієнту відповідь про те, що вказану сутність не знайдено.
function sendNotFound(res, entity = 'проєкт') {
  return res.status(404).json({
    error: `Не вдалося знайти: ${entity}`
  })
}

module.exports = { sendNotFound }
