// Цей файл створює безпечні випадкові токени сесій та їхні односторонні хеші.

const crypto = require("crypto");

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function hashSessionToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

// Клієнт отримує випадковий токен, а база зберігає лише його хеш.
function createSessionCredentials() {
    const token = crypto.randomBytes(32).toString("hex");

    return {
        token,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
    };
}

module.exports = { createSessionCredentials, hashSessionToken };
