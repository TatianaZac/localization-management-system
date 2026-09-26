// Регресійний сценарій використовує HTTP та завжди прибирає власні тимчасові дані.
const { test } = require('node:test');
const prisma = require('../src/prisma');
const { checkWorkflow } = require('../scripts/checkWorkflow');
test('повний HTTP-сценарій трьох ролей', async () => {
    try { await checkWorkflow(); } finally { await prisma.$disconnect(); }
});
