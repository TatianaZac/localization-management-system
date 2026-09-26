// Цей файл хешує та перевіряє паролі за допомогою вбудованого crypto Node.js.

const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);

// Створює випадкову сіль і зберігає її поруч із результатом повільного хешування scrypt.
async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const derivedKey = await scrypt(password, salt, 64);
    return `${salt}:${derivedKey.toString("hex")}`;
}

// Порівнює хеші за сталий час, щоб не розкривати пароль через різницю у швидкості відповіді.
async function verifyPassword(password, storedHash) {
    const [salt, savedKeyHex] = String(storedHash || "").split(":");

    if (!salt || !savedKeyHex) return false;

    const savedKey = Buffer.from(savedKeyHex, "hex");
    const derivedKey = await scrypt(password, salt, savedKey.length);

    return savedKey.length === derivedKey.length
        && crypto.timingSafeEqual(savedKey, derivedKey);
}

module.exports = { hashPassword, verifyPassword };
