# LocaleFlow

Дипломний проєкт: система керування локалізаційними проєктами.

## Технології

- клієнт: React + JavaScript
- запуск клієнта: Vite
- сервер: Node.js + Express
- база даних: PostgreSQL + Prisma

## Запуск

Відкрий два термінали.

### Сервер

```powershell
cd D:\localization-management-system\server
npm run dev
```

### Клієнт

```powershell
cd D:\localization-management-system\client
npm run dev
```

Після цього відкрий адресу, яку покаже клієнт, зазвичай http://localhost:5173.

## Швидка перевірка

1. Створи проєкт.
2. Додай українську мову: `uk` — `Українська`.
3. Імпортуй файл `examples/en.json`.
4. У таблиці мають з’явитися 13 ключів локалізації.
