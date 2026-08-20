# LocaleFlow

Дипломний проєкт: інформаційна система керування локалізаційними проєктами.

## Технології

- клієнт: React + JavaScript
- запуск клієнта: Vite
- сервер: Node.js + Express
- база даних: PostgreSQL + Prisma

## Структура

```text
client/src/
  api/            запити до сервера
  components/     невеликі повторно використовувані частини інтерфейсу
  pages/          екрани застосунку
  styles/         стилі сторінок і компонентів
  App.jsx         підключає головну сторінку
  main.jsx        запускає React

server/src/
  controllers/    приймають запити й повертають відповіді
  routes/         описують адреси API
  services/       предметна логіка, наприклад імпорт JSON
  utils/          невеликі допоміжні функції
  middleware/     обробляє помилки
  app.js          підключає маршрути та налаштування Express
  server.js       запускає сервер
```

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

Потім відкрий адресу, яку покаже Vite, зазвичай http://localhost:5173.

## Швидка перевірка

1. Створи проєкт.
2. Додай українську мову: `uk` — `Українська`.
3. Імпортуй файл `examples/en.json`.
4. У таблиці мають з’явитися 13 ключів локалізації.
