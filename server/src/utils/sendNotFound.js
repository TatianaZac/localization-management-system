function sendNotFound(res, entity = "Project") {
    return res.status(404).json({
        error: entity + " was not found"
    });
}

module.exports = { sendNotFound };
