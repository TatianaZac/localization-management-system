function errorHandler(error, req, res, next) {
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
