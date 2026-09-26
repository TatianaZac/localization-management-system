// Цей файл містить допоміжну функцію для однакових HTTP-відповідей 404.

// Надсилає клієнту відповідь про те, що вказану сутність не знайдено.
function sendNotFound(res, entity = "Project") {
    return res.status(404).json({
        error: entity + " was not found"
    });
}

module.exports = { sendNotFound };
