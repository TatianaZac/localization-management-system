// Цей файл містить централізований обробник помилок Express API.

// Перетворює відомі помилки бази та неочікувані винятки на HTTP-відповіді.
function errorHandler(error, req, res, next) {
    if ([400, 404, 409].includes(error.status)) return res.status(error.status).json({ error: error.message });
    if (error.code === 'P2034') return res.status(409).json({ error: 'Дані одночасно змінилися. Онови сторінку та повтори дію.' });
    if (error.code === "P2002") {
        return res.status(409).json({
            error: "A record with this value already exists"
        });
    }

    console.error(error);
    res.status(500).json({
        error: "Internal server error"
    });
}

module.exports = errorHandler;
