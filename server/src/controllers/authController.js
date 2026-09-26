// Цей файл реалізує реєстрацію, вхід, перевірку поточної сесії та вихід.

const prisma = require("../prisma");
const { hashPassword, verifyPassword } = require("../utils/passwords");
const { createSessionCredentials } = require("../utils/sessions");
const { getText } = require("../utils/validation");

function normalizeEmail(value) {
    return getText(value).toLowerCase();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(user) {
    return { id: user.id, name: user.name, email: user.email };
}

// Створює серверну сесію та повертає клієнту тільки її відкритий випадковий токен.
async function issueSession(user) {
    const credentials = createSessionCredentials();

    await prisma.session.create({
        data: {
            userId: user.id,
            tokenHash: credentials.tokenHash,
            expiresAt: credentials.expiresAt
        }
    });

    return { token: credentials.token, user: publicUser(user) };
}

// Реєструє користувача; перший акаунт отримує наявні проєкти без власника.
async function register(req, res, next) {
    try {
        const name = getText(req.body.name);
        const email = normalizeEmail(req.body.email);
        const password = typeof req.body.password === "string" ? req.body.password : "";

        if (!name || !isValidEmail(email) || password.length < 8) {
            return res.status(400).json({
                error: "Name, valid email and password of at least 8 characters are required"
            });
        }

        const passwordHash = await hashPassword(password);
        const user = await prisma.$transaction(async (transaction) => {
            const existingUsers = await transaction.user.count();
            const createdUser = await transaction.user.create({
                data: { name, email, passwordHash }
            });

            // Це одноразовий міст для даних, створених до появи авторизації.
            // Лише найперший акаунт отримує старі проєкти, у яких ownerId ще порожній.
            if (existingUsers === 0) {
                await transaction.project.updateMany({
                    where: { ownerId: null },
                    data: { ownerId: createdUser.id }
                });
            }

            return createdUser;
        });

        res.status(201).json(await issueSession(user));
    } catch (error) {
        next(error);
    }
}

// Перевіряє пару email/пароль і створює нову незалежну сесію.
async function login(req, res, next) {
    try {
        const email = normalizeEmail(req.body.email);
        const password = typeof req.body.password === "string" ? req.body.password : "";
        const user = await prisma.user.findUnique({ where: { email } });
        const isPasswordValid = user?.passwordHash
            ? await verifyPassword(password, user.passwordHash)
            : false;

        // Однакове повідомлення не дозволяє визначити, чи зареєстрована конкретна адреса.
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Email or password is incorrect" });
        }

        res.json(await issueSession(user));
    } catch (error) {
        next(error);
    }
}

function getCurrentUser(req, res) {
    res.json(req.user);
}

// Видаляє тільки поточну сесію; інші пристрої користувача залишаються авторизованими.
async function logout(req, res, next) {
    try {
        await prisma.session.deleteMany({
            where: { tokenHash: req.sessionTokenHash }
        });
        res.status(204).end();
    } catch (error) {
        next(error);
    }
}

module.exports = { register, login, getCurrentUser, logout };
