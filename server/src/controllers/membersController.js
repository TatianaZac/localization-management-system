// Цей файл керує учасниками та ролями всередині окремого проєкту.

const prisma = require("../prisma");
const { getProjectId, getText } = require("../utils/validation");
const { sendNotFound } = require("../utils/sendNotFound");

const ALLOWED_ROLES = new Set(["EDITOR", "REVIEWER"]);

function getRole(value) {
    const role = getText(value).toUpperCase();
    return ALLOWED_ROLES.has(role) ? role : null;
}

// Повертає власника окремо та список учасників, яким він призначив ролі.
async function getMembers(req, res, next) {
    try {
        const projectId = getProjectId(req.params.projectId);
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: {
                owner: { select: { id: true, name: true, email: true } },
                members: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        id: true,
                        role: true,
                        user: { select: { id: true, name: true, email: true } }
                    }
                }
            }
        });

        res.json({
            owner: { ...project.owner, role: "OWNER" },
            members: project.members
        });
    } catch (error) {
        next(error);
    }
}

// Додає за email лише вже зареєстрованого користувача.
async function addMember(req, res, next) {
    try {
        const projectId = getProjectId(req.params.projectId);
        const email = getText(req.body.email).toLowerCase();
        const role = getRole(req.body.role);

        if (!email || !role) {
            return res.status(400).json({ error: "Valid email and project role are required" });
        }

        const [project, user] = await Promise.all([
            prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } }),
            prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } })
        ]);

        if (!user) return sendNotFound(res, "Registered user");

        if (user.id === project.ownerId) {
            return res.status(400).json({ error: "The project owner is already a participant" });
        }

        const existingMember = await prisma.projectMember.findUnique({
            where: { projectId_userId: { projectId, userId: user.id } }
        });

        if (existingMember) {
            return res.status(409).json({ error: "This user is already a project member" });
        }

        const member = await prisma.projectMember.create({
            data: { projectId, userId: user.id, role },
            select: { id: true, role: true }
        });

        res.status(201).json({ ...member, user });
    } catch (error) {
        next(error);
    }
}

// Змінює роль наявного учасника, не торкаючись прав власника.
async function updateMember(req, res, next) {
    try {
        const projectId = getProjectId(req.params.projectId);
        const memberId = getProjectId(req.params.memberId);
        const role = getRole(req.body.role);

        if (!memberId || !role) {
            return res.status(400).json({ error: "Member id or project role is invalid" });
        }

        const member = await prisma.projectMember.findFirst({
            where: { id: memberId, projectId }
        });

        if (!member) return sendNotFound(res, "Project member");

        const updatedMember = await prisma.projectMember.update({
            where: { id: memberId },
            data: { role },
            select: {
                id: true,
                role: true,
                user: { select: { id: true, name: true, email: true } }
            }
        });

        res.json(updatedMember);
    } catch (error) {
        next(error);
    }
}

// Відкликає доступ учасника; його акаунт і виконані переклади залишаються в системі.
async function deleteMember(req, res, next) {
    try {
        const projectId = getProjectId(req.params.projectId);
        const memberId = getProjectId(req.params.memberId);

        if (!memberId) {
            return res.status(400).json({ error: "Member id is invalid" });
        }

        const member = await prisma.projectMember.findFirst({
            where: { id: memberId, projectId },
            select: { id: true }
        });

        if (!member) return sendNotFound(res, "Project member");

        await prisma.projectMember.delete({ where: { id: memberId } });
        res.status(204).end();
    } catch (error) {
        next(error);
    }
}

module.exports = { getMembers, addMember, updateMember, deleteMember };
