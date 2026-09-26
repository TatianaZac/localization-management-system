<!-- Цей файл містить навчальний україномовний розбір архітектури та коду LocaleFlow. -->

# LocaleFlow: навчальний розбір проєкту

Оновлення: сторінки та незалежні знімки файлів описано в `PAGE_VERSIONS_UK.md`. Це основне джерело для нового імпорту й вибору версій; згадки про старий `handleFileChange` нижче стосуються попереднього інтерфейсу.

Глосарій: `GlossaryConcept` зберігає спільний термін і визначення в межах проєкту, а `GlossaryEntry` — мовний варіант та його статус `PENDING`, `APPROVED` або `ARCHIVED`. Усі учасники можуть читати й пропонувати. Лише REVIEWER погоджує, архівує та уточнює спільне визначення. Власник призначає рецензентів через наявну сторінку учасників. Авторство й рішення беруться з серверної сесії. Пропозиції не перезаписують чинний переклад: погодження атомарно архівує попередній варіант. Часткові унікальні індекси SQL дозволяють лише один PENDING та один APPROVED на поняття й мову; Serializable-транзакція та updatedAt захищають рішення від одночасних змін. Старі записи перенесені на погодження без вигаданого авторства.

`GlossaryPage` має таблицю, фільтри, мовні варіанти та компактну бічну панель. `GlossaryProposal` дозволяє запропонувати термін прямо біля перекладу. `matchesGlossaryTerm` знаходить буквальні фрази з межами слів Unicode; відмінювання та синоніми не визначаються. У підказки потрапляють лише APPROVED для вибраної мови. Архів зберігає попередні варіанти; видалення проєкту або мови каскадно видаляє пов'язані записи. Інтеграційний тест `server/tests/glossary.test.js` використовує локальну БД і відкочує всі тестові дані. Під час тесту не створюються акаунти.

Обґрунтування прав: Crowdin підтримує пропозиції-чернетки (https://support.crowdin.com/glossary/), Phrase розділяє нові терміни й погоджені записи (https://support.phrase.com/hc/en-us/articles/10112307347868-Edit-Term-Attributes-and-Concept-Fields-TMS). Наш розподіл — команда пропонує, рецензент погоджує, власник керує командою — адаптує ці підходи до трьох ролей проєкту.

Історія перекладу: `TranslationHistory` зберігає автора (із серверної сесії), роль на момент дії, текст, статус, версію оригіналу та причину повернення. Вкладене `history.create` у `translation.update` атомарно записує дію разом зі зміною перекладу. Права читання успадковуються від доступу до проєкту. Справа показано останні 50 дій; старіші записи залишаються в базі. Раніше зроблені зміни не відновлюються заднім числом. Звичайні коментарі та повторний імпорт оригіналу не є діями цієї історії.

Повернення на доопрацювання: рецензент передає статус `NEEDS_REVISION` і обов'язкову причину `reviewReason` (до 2000 символів). Сервер забороняє це власнику та редактору, а рецензенту забороняє змінювати текст. Причина зберігається окремо від коментаря й показується справа. Повторне збереження редактором переводить рядок у `TRANSLATED` та очищає поточну причину. Історії попередніх зауважень поки немає. `OUTDATED` залишається окремим статусом для зміненого оригіналу.

Цей документ пояснює проєкт від загальної картини до окремих функцій. Його краще читати не за алфавітом, а в порядку, наведеному в кінці.

Не намагайся вивчити його за один раз. Відкрий поруч файл, про який читаєш, знайди описану функцію і пройди її зверху вниз. Після кожного розділу корисно самостійно відповісти: «Хто викликає цей код?» і «Що він викликає далі?».

## 1. Найголовніше: з яких рівнів складається програма

У програмі є три основні рівні.

### Рівень 1 — клієнт (`client`)

Це сторінка, яку бачить користувач у браузері. Вона написана на React.

Клієнт:

- показує проєкти, форми й таблицю;
- реагує на натискання кнопок;
- тимчасово зберігає введені значення;
- надсилає запити серверу;
- показує отримані від сервера дані.

Клієнт не працює з PostgreSQL напряму.

### Рівень 2 — сервер (`server/src`)

Це Node.js + Express програма, яка працює на `http://localhost:5000`.

Сервер:

- приймає HTTP-запити від клієнта;
- перевіряє дані;
- виконує бізнес-логіку;
- звертається до бази через Prisma;
- повертає JSON-відповідь.

### Рівень 3 — база даних (`server/prisma`)

PostgreSQL зберігає проєкти, мови, ключі, версії оригіналів і переклади. Prisma перетворює JavaScript-команди на SQL-запити.

Загальний шлях даних:

```text
Кнопка в React
→ функція сторінки
→ localizationApi.js
→ HTTP-запит
→ Express route
→ controller
→ service або Prisma
→ PostgreSQL
→ JSON-відповідь
→ React оновлює екран
```

## 2. Приклад повного шляху: збереження перекладу

1. Користувач вводить `Увійти` в `TranslationTable.jsx`.
2. `TranslationRow.save()` викликає передану функцію `onSave(...)`.
3. Насправді `onSave` — це `handleSaveTranslation()` із `ProjectEditorPage.jsx`.
4. Вона викликає `updateTranslation()` із `localizationApi.js`.
5. Браузер надсилає `PATCH /api/projects/1/translations/10`.
6. `server/src/routes/projects.js` передає запит у `updateTranslation()`.
7. `translationsController.js` перевіряє ID, текст і статус.
8. Prisma оновлює запис `Translation` у PostgreSQL.
9. Сервер повертає оновлений переклад.
10. `replaceTranslation()` замінює старий переклад у React-стані.
11. React повторно малює рядок із новим текстом і статусом.

## 3. Мінімальний словник JavaScript і React

### `import` та `export`

```js
export function getProjects() {}
import { getProjects } from '../api/localizationApi'
```

`export` дозволяє іншому файлу використати значення. `import` підключає його.

### `const` і `let`

- `const` — змінній не можна присвоїти інше значення;
- `let` — значення змінної можна замінити.

Об'єкт усередині `const` усе одно може змінювати свої поля.

### `async` і `await`

HTTP-запит або запит до бази потребує часу. `await` чекає завершення операції, а `async` дозволяє використовувати `await` у функції.

### `try`, `catch`, `finally`

- `try` — спробувати виконати операцію;
- `catch` — обробити помилку;
- `finally` — виконати код у будь-якому випадку.

### `?.` і `??`

```js
project?.name
translation?.value ?? ''
```

- `?.` не спричиняє помилку, якщо значення відсутнє;
- `??` бере праву частину, якщо ліва дорівнює `null` або `undefined`.

### `.map()`, `.filter()`, `.find()`

- `.map()` створює новий масив, перетворюючи кожен елемент;
- `.filter()` залишає лише потрібні елементи;
- `.find()` повертає перший знайдений елемент.

### JSX

JSX — HTML-подібний запис усередині JavaScript:

```jsx
<button onClick={handleSave}>{project.name}</button>
```

Фігурні дужки означають: «виконати JavaScript у цьому місці».

### Props

Props — дані або функції, які батьківський компонент передає дочірньому:

```jsx
<TranslationTable translationKeys={visibleKeys} />
```

### `useState`

```js
const [query, setQuery] = useState('')
```

- `query` — поточне значення;
- `setQuery()` — функція зміни;
- `''` — початкове значення.

Після `setQuery()` React повторно малює компонент.

### `useEffect`

Виконує побічну дію після показу компонента. У проєкті використовується для завантаження даних і підписки на кнопку браузера «назад».

### `useMemo`

Запам'ятовує результат обчислення і повторює його лише тоді, коли змінилися залежності. Тут він використовується для лічильників та фільтрації.

### `useRef`

Зберігає посилання на HTML-елемент без повторного малювання. Тут це приховане поле вибору файла.

## 4. Клієнт: файли запуску й конфігурації

### `client/index.html`

Початковий HTML-документ.

- `<html lang="uk">` повідомляє, що мова сторінки українська;
- `<div id="root"></div>` — порожнє місце, куди React вставляє весь інтерфейс;
- `<script type="module" src="/src/main.jsx">` запускає клієнтський код.

### `client/package.json`

Опис клієнтського застосунку.

- `react`, `react-dom` — основні бібліотеки;
- `vite` — запускає локальний сервер і збирає застосунок;
- `npm run dev` — режим розробки;
- `npm run build` — фінальна збірка;
- `private: true` — забороняє випадкову публікацію пакета в npm.

### `client/vite.config.js`

Конфігурація Vite. Підключає `@vitejs/plugin-react`, щоб Vite розумів JSX і React.

### `client/src/main.jsx`

Головна точка входу клієнта.

```js
createRoot(document.getElementById('root')).render(...)
```

Знаходить `<div id="root">` у `index.html` і вставляє туди `<App />`.

`StrictMode` допомагає помічати проблеми під час розробки. У режимі розробки деякі перевірки можуть виконуватися двічі — це нормально.

### `client/src/App.jsx`

Головний React-компонент і простий маршрутизатор.

#### `getProjectId(pathname)`

Перевіряє адресу браузера регулярним виразом:

```text
/projects/15 → 15
/projects → null
```

`\d+` означає одну або більше цифр.

#### `App()`

- `pathname` зберігає поточну адресу;
- `user` зберігає користувача активної сесії;
- під час запуску `getCurrentUser()` перевіряє збережений токен;
- `useEffect` слухає подію `popstate`, тобто кнопки браузера «назад/вперед»;
- `navigate(path)` змінює адресу без перезавантаження сторінки;
- без користувача показується `AuthPage`;
- якщо в адресі є ID — показує `ProjectEditorPage`;
- інакше показує `ProjectsPage`.

У великому застосунку для цього зазвичай використовують React Router, але тут зроблений маленький власний варіант.

### `client/src/pages/AuthPage.jsx`

Містить два режими однієї форми: вхід і реєстрацію. Після успіху передає токен і відкриті дані користувача в `App`. Пароль у React-стані існує лише під час заповнення форми та ніколи не записується в `localStorage`.

## 5. Клієнт: робота із сервером

### `client/src/api/localizationApi.js`

Єдине місце для HTTP-запитів. Компоненти не повинні самостійно складати URL.

#### `API_URL`

Бере `VITE_API_URL` із налаштувань або використовує `http://localhost:5000/api`.

#### `request(path, options)`

Спільна функція для більшості запитів.

1. Викликає браузерний `fetch()`.
2. Додає заголовок `Content-Type: application/json`.
3. Якщо токен існує, додає `Authorization: Bearer ...`.
4. Пробує прочитати JSON-відповідь.
5. Якщо статус неуспішний — створює `Error`.
6. Якщо все добре — повертає тіло відповіді.

#### Інші функції

- `registerUser()` — реєструє користувача;
- `loginUser()` — створює сесію;
- `getCurrentUser()` — перевіряє збережену сесію;
- `logoutUser()` — закриває поточну сесію;
- `getProjectMembers()` — отримує команду проєкту;
- `addProjectMember()` — додає зареєстрованого користувача за email;
- `updateProjectMember()` — змінює роль учасника;
- `deleteProjectMember()` — відкликає доступ учасника;
- `getProjects()` — `GET /projects`, отримує список;
- `getProject(projectId)` — `GET /projects/:id`, отримує один проєкт із ключами;
- `createProject(project)` — `POST /projects`, створює проєкт;
- `createLocale(projectId, locale)` — додає мову;
- `importSourceFile(projectId, content)` — надсилає прочитаний JSON;
- `updateTranslation(...)` — зберігає текст і статус;
- `updateTranslationComment(...)` — зберігає примітку до перекладу;
- `downloadLocaleFile(...)` — отримує файл як `Blob`, створює тимчасове посилання і запускає завантаження.

`JSON.stringify()` перетворює JavaScript-об'єкт на JSON-рядок для відправлення серверу.

## 6. Клієнт: сторінка проєктів

### `client/src/pages/ProjectsPage.jsx`

Показує список проєктів, форми створення та редагування і діалог підтвердження видалення.

#### Стан

- `projects` — масив проєктів;
- `isLoading` — чи завантажується список;
- `isSaving` — чи створюється проєкт;
- `editingProject` — проєкт, дані якого зараз змінюються;
- `deleteCandidate` — проєкт, для якого відкрито підтвердження видалення;
- `error`, `notice` — повідомлення про помилку або успіх.

#### `useEffect(...)`

Після першого показу сторінки викликає `getProjects()`.

- `.then(setProjects)` зберігає результат;
- `.catch(...)` зберігає помилку;
- `.finally(...)` вимикає індикатор завантаження.

Порожній масив `[]` означає: виконати ефект один раз після появи компонента.

#### `handleCreateProject(projectData)`

1. Очищає стару помилку.
2. Вмикає стан збереження.
3. Викликає API.
4. Після успіху відкриває створений проєкт через `onOpenProject(project.id)`.
5. Повертає `true` або `false` формі.
6. У `finally` вимикає стан збереження.

#### `handleUpdateProject(projectData)`

Викликає API оновлення, замінює змінений проєкт у масиві `projects` і закриває форму редагування.

#### `handleDeleteProject()`

Працює лише після відкриття діалогу підтвердження. Видаляє проєкт через API, а потім прибирає його зі списку на екрані.

#### JSX

У JSX три варіанти вмісту:

- `isLoading` — напис «Завантаження»;
- порожній масив — повідомлення «Ще немає проєктів»;
- інакше `.map()` створює картку з діями відкриття, редагування та видалення.

### `client/src/components/projects/CreateProjectForm.jsx`

Окремий компонент форми.

#### Стан

Зберігає `name`, `description`, `sourceCode`, `sourceName` — значення чотирьох полів.

Поля є контрольованими: значення йде з React-стану, а `onChange` оновлює стан.

#### `handleSubmit(event)`

1. `event.preventDefault()` не дозволяє браузеру перезавантажити сторінку.
2. Викликає передану функцію `onCreate(...)`.
3. Якщо вона повернула `true`, очищає назву та опис.

Сам компонент не знає, як працює сервер. Він лише збирає дані й передає їх сторінці.

### `client/src/components/projects/EditProjectForm.jsx`

Отримує вибраний проєкт через props, дозволяє змінити назву та опис і передає результат у `ProjectsPage`. Мова оригіналу після створення не змінюється, щоб не порушити зв'язки вже імпортованих даних.

## 7. Клієнт: редактор проєкту

### `client/src/pages/ProjectEditorPage.jsx`

Це головний і найбільший клієнтський файл. Він керує всім екраном редактора.

#### `STATUS_FILTERS`

Масив варіантів фільтра. `value` відповідає значенню в базі, `label` — тексту в інтерфейсі.

#### `getTranslation(translationKey, localeCode)`

Один ключ може мати переклади кількома мовами. Функція знаходить переклад для вибраної мови.

#### Стан компонента

- `project` — повний об'єкт проєкту із сервера;
- `selectedLocaleCode` — вибрана цільова мова;
- `selectedKeyId` — ключ, показаний у правій панелі;
- `query` — пошуковий текст;
- `statusFilter` — активний статусний фільтр;
- `isLoading` — початкове завантаження;
- `isSaving` — додавання мови або імпорт;
- `showLocaleForm` — показати/сховати форму мови;
- `showLocaleManager` — показати/сховати керування всіма мовами;
- `showMembers`, `membersData` — панель і завантажені учасники проєкту;
- `localeCode`, `localeName` — поля цієї форми;
- `notice`, `error` — повідомлення;
- `fileInputRef` — посилання на приховане поле вибору JSON.

#### `loadProject()`

Завантажує проєкт і вибирає першу доступну цільову мову. Якщо раніше вибрана мова ще існує, вибір не скидається.

#### Початковий `useEffect`

Викликає `loadProject()` під час відкриття проєкту або зміни `projectId`.

#### `targetLocales`

Відкидає мову оригіналу через `.filter(locale => !locale.isSource)`.

#### `statusCounts`

Рахує, скільки ключів мають кожен статус для вибраної мови. `useMemo` перераховує значення після зміни проєкту або мови.

#### `visibleKeys`

Формує рядки, які треба показати:

1. приводить пошук до нижнього регістру;
2. перевіряє статус;
3. шукає збіг у ключі, оригіналі або перекладі;
4. повертає лише рядки, що пройшли обидві перевірки.

#### `selectedKey` і `selectedTranslation`

Знаходять дані для правої інформаційної панелі. Якщо користувач ще нічого не вибрав, береться перший видимий ключ.

#### `replaceTranslation(updatedTranslation)`

Оновлює вкладений React-стан без повторного завантаження всього проєкту.

Важливо: React-стан не змінюють напряму. Тому створюються нові об'єкти через `{ ...oldObject }` і нові масиви через `.map()`.

#### `handleSaveTranslation(...)`

Надсилає переклад серверу, замінює його в стані й показує повідомлення.

#### `handleAddLocale(event)`

Зупиняє звичайну відправку форми, додає мову, повторно завантажує проєкт, вибирає нову мову і ховає форму.

#### `handleRenameLocale(localeId, name)`

Зберігає нову назву через API. Потім оновлює її у двох місцях React-стану: у списку локалей та у вкладених об'єктах перекладів. Це дає однакову назву в усьому інтерфейсі без повторного запиту.

#### `handleDeleteLocale(localeId)`

Видаляє цільову мову, після чого завантажує проєкт заново. Повторне завантаження потрібне, тому що база каскадно видаляє одразу багато пов'язаних перекладів.

#### Керування учасниками

- `handleToggleMembers()` завантажує команду лише після відкриття панелі;
- `handleAddMember()` додає користувача за email;
- `handleChangeMemberRole()` замінює роль у React-стані;
- `handleDeleteMember()` відкликає доступ, але не видаляє акаунт.

`canManageProject`, `canEditTranslations` і `canReviewTranslations` перетворюють роль поточного користувача на конкретні дозволені дії інтерфейсу.

Власник має лише керувальні дії. Редагування тексту вмикається тільки для `EDITOR`, а кнопка затвердження — тільки для `REVIEWER`. Після повернення у вкладку проєкт завантажується повторно, тому зміна ролі не залишає старих активних кнопок.

#### `handleFileChange(event)`

1. Дістає перший вибраний файл.
2. Читає його через `file.text()`.
3. Перетворює текст через `JSON.parse()`.
4. Надсилає об'єкт серверу.
5. Повторно завантажує проєкт.
6. Показує статистику імпорту.
7. Очищає поле файла, щоб той самий файл можна було вибрати знову.

#### `handleExport()`

Запускає завантаження JSON для вибраної мови.

#### Умовні повернення

- поки `isLoading` — показує завантаження;
- якщо `project` не отримано — показує помилку;
- інакше повертає основний інтерфейс.

#### Основні частини JSX

- `editor-sidebar` — ліва навігація;
- `editor-topbar` — верхній рядок;
- `project-title-row` — назва й дії;
- `locale-create-bar` — умовна форма мови;
- `locale-manager` — список мов із діями перейменування й видалення;
- `members-manager` — команда проєкту, ролі й форма додавання за email;
- `editor-onboarding` — підказки для порожнього проєкту;
- `status-tabs` — кнопки статусів;
- `editor-toolbar` — пошук і вибір мови;
- `TranslationTable` — таблиця;
- `key-details` — права контекстна панель з актуальністю, історією оригіналу та коментарем.

### `client/src/components/projects/TranslationTable.jsx`

Містить два компоненти й одну допоміжну функцію.

#### `statusLabel(status)`

Перетворює серверне `REVIEWED` на українське `Перевірено`.

#### `TranslationRow(...)`

Відповідає за один рядок таблиці.

- знаходить переклад вибраною мовою;
- `draft` зберігає текст, який зараз введено;
- `isSaving` блокує повторне натискання під час запиту;
- `useEffect` оновлює поле після зміни мови або отримання нового значення.

##### `save()`

Передає ID, змінений текст і статус `TRANSLATED` батьківському компоненту. Повторний запит під час збереження або без змін не надсилається.

Редактор викликає `save()` натисканням `Enter`. Під полем видно незбережені зміни або процес збереження.

Кнопок збереження та затвердження в таблиці немає. Рецензент затверджує вибраний збережений переклад через `handleApproveTranslation()` у правій панелі; редактор і власник цієї кнопки не бачать.

#### `TranslationTable(...)`

- якщо рядків немає — показує порожній стан;
- інакше створює таблицю;
- `.map()` створює `TranslationRow` для кожного ключа;
- `key={translationKey.id}` допомагає React розрізняти рядки.

## 8. Клієнт: CSS

CSS не містить JavaScript-функцій. Кожне правило описує вигляд елемента з відповідним `className`.

### `client/src/index.css`

Глобальні правила: шрифт, фон, `box-sizing`, вигляд полів і спільні класи кнопок.

### `client/src/styles/ProjectsPage.css`

Оформлення сторінки проєктів:

- шапка й логотип;
- двоколонкове розташування;
- картки проєктів;
- форма створення;
- адаптація до вузьких екранів через `@media`.

### `client/src/styles/ProjectEditorPage.css`

Оформлення редактора:

- темна ліва панель;
- верхня навігація;
- кнопки статусних фільтрів;
- панель пошуку;
- сітка таблиці та деталей;
- адаптивна поведінка.

### `client/src/styles/TranslationTable.css`

Оформлення таблиці, полів перекладу, вибраного рядка, кнопок і кольорів статусів.

## 9. Сервер: запуск і підключення

### `server/package.json`

- `express` — HTTP-сервер;
- `cors` — дозволяє клієнту з іншого порту звертатися до API;
- `dotenv` — читає `.env`;
- `prisma`, `@prisma/client` — робота з БД;
- `pg`, `@prisma/adapter-pg` — підключення PostgreSQL;
- `nodemon` — перезапускає сервер після зміни коду.

### `server/src/server.js`

Справжня точка запуску сервера.

1. Читає `.env`.
2. Імпортує налаштований Express-застосунок.
3. Бере `PORT` або використовує `5000`.
4. `app.listen()` починає слухати запити.

### `server/src/app.js`

Налаштовує Express, але не запускає порт.

- `cors()` дозволяє запити клієнта;
- `express.json({ limit: '2mb' })` читає JSON-тіло та обмежує розмір;
- `/` повертає простий текст;
- `/api/health` перевіряє стан сервера;
- `/api/auth` підключає реєстрацію, вхід і вихід;
- `/api/projects` підключає всі маршрути проєкту;
- `errorHandler` стоїть останнім і ловить необроблені помилки.

Розділення `app.js` і `server.js` полегшує тестування.

### `server/src/prisma.js`

Створює єдиний об'єкт для роботи з базою.

- перевіряє `DATABASE_URL`;
- створює PostgreSQL-адаптер;
- створює `PrismaClient`;
- експортує його контролерам і сервісам.

## 10. Сервер: маршрути

### `server/src/routes/auth.js`

| Метод і шлях | Функція | Призначення |
|---|---|---|
| `POST /api/auth/register` | `register` | створення акаунта і сесії |
| `POST /api/auth/login` | `login` | вхід за email і паролем |
| `GET /api/auth/me` | `getCurrentUser` | поточний користувач |
| `POST /api/auth/logout` | `logout` | завершення поточної сесії |

### `server/src/routes/projects.js`

Це таблиця відповідності «метод + адреса → функція».

| Метод і шлях | Функція | Призначення |
|---|---|---|
| `GET /api/projects` | `getProjects` | список проєктів |
| `POST /api/projects` | `createProject` | створення |
| `GET /api/projects/:projectId` | `getProject` | один проєкт |
| `PATCH /api/projects/:projectId` | `updateProject` | редагування назви й опису |
| `DELETE /api/projects/:projectId` | `deleteProject` | видалення проєкту |
| `GET /api/projects/:projectId/members` | `getMembers` | команда проєкту |
| `POST /api/projects/:projectId/members` | `addMember` | додавання учасника |
| `PATCH /api/projects/:projectId/members/:memberId` | `updateMember` | зміна ролі |
| `DELETE /api/projects/:projectId/members/:memberId` | `deleteMember` | відкликання доступу |
| `POST /api/projects/:projectId/locales` | `addLocale` | нова мова |
| `PATCH /api/projects/:projectId/locales/:localeId` | `updateLocale` | перейменування цільової мови |
| `DELETE /api/projects/:projectId/locales/:localeId` | `deleteLocale` | видалення цільової мови |
| `POST /api/projects/:projectId/import` | `importSourceFile` | імпорт оригіналу |
| `PATCH /api/projects/:projectId/translations/:translationId` | `updateTranslation` | збереження перекладу |
| `PATCH /api/projects/:projectId/translations/:translationId/comment` | `updateTranslationComment` | збереження коментаря |
| `GET /api/projects/:projectId/export/:localeCode` | `exportLocale` | експорт JSON |

`:` позначає змінну частину адреси. Вона доступна в `req.params`.

Перед усіма маршрутами проєктів виконується `requireAuth`. Для адрес із `:projectId` додатково виконується `requireProjectOwner`, тому контролер не запускається для чужого проєкту.

## 11. Сервер: контролери

Контролер приймає `req`, формує `res` і передає несподівані помилки через `next(error)`.

### `server/src/controllers/authController.js`

- `register()` перевіряє дані, хешує пароль і створює користувача;
- перший користувач отримує старі проєкти без `ownerId`, зокрема `MyProject`;
- `login()` перевіряє пароль і видає новий випадковий токен;
- `getCurrentUser()` повертає дані активного користувача без хешу пароля;
- `logout()` видаляє лише поточну сесію.

### `server/src/controllers/projectsController.js`

#### `getProjects(req, res, next)`

Отримує проєкти, сортує за датою оновлення, рахує мови й ключі. Перетворює Prisma-поле `_count` на зручні `localeCount` і `keyCount`.

Список містить як власні проєкти, так і проєкти, до яких користувача запросили. Поле `currentUserRole` повідомляє клієнту роль в кожному з них.

#### `createProject(req, res, next)`

Очищає текстові поля, перевіряє назву та код мови, а потім одним Prisma-запитом створює проєкт і його початкову локаль.

`res.status(201)` означає «ресурс успішно створений».

#### `updateProject(req, res, next)`

Перевіряє ID і назву, переконується, що проєкт існує, та оновлює лише його назву й опис.

#### `deleteProject(req, res, next)`

Перевіряє існування проєкту та видаляє його. Пов'язані локалі, ключі, версії оригіналів і переклади видаляються базою каскадно. Успішна відповідь має статус `204` без JSON-тіла.

#### `getProject(req, res, next)`

Отримує один проєкт разом із:

- мовами;
- ключами;
- усіма версіями оригіналів у порядку від нової до старої;
- усіма перекладами та назвами їхніх мов.

### `server/src/controllers/localesController.js`

#### `addLocale(...)`

1. Перевіряє ID, код і назву.
2. Переконується, що проєкт існує.
3. Забороняє повторно додати мову оригіналу.
4. Усередині транзакції створює локаль.
5. Для всіх наявних ключів створює порожні переклади.

#### `updateLocale(...)`

Перевіряє належність локалі проєкту, забороняє редагувати вихідну локаль і змінює лише зрозумілу користувачу назву. Код залишається стабільним для API та експорту.

#### `deleteLocale(...)`

Забороняє видалення мови оригіналу. Після видалення цільової локалі PostgreSQL каскадно видаляє всі її переклади.

### `server/src/controllers/membersController.js`

- `getMembers()` повертає власника та запрошених учасників;
- `addMember()` знаходить уже зареєстрованого користувача за email;
- `updateMember()` перемикає ролі `EDITOR` і `REVIEWER`;
- `deleteMember()` видаляє лише членство, зберігаючи акаунт і переклади.

Транзакція означає: або виконаються всі кроки, або не збережеться жоден.

### `server/src/controllers/importController.js`

#### `importSourceFile(...)`

Перевіряє проєкт і мову оригіналу, дістає `content`, викликає `importSourceTexts()` і повертає статистику. Очікувані помилки JSON повертає зі статусом `400`.

### `server/src/controllers/translationsController.js`

#### `ALLOWED_STATUSES`

`Set` із дозволеними статусами, які користувач може встановити вручну: `TRANSLATED` і `REVIEWED`.

#### `updateTranslation(...)`

1. Перевіряє ID.
2. Знаходить переклад і його поточний оригінал.
3. Забороняє редагувати оригінальну мову як переклад.
4. Перевіряє статус.
5. Забороняє підтверджувати порожній переклад.
6. Порожній текст переводить у `NEW`.
7. Збережений текст отримує `TRANSLATED` або `REVIEWED`.
8. Запам'ятовує версію оригіналу в `sourceVersion`.
9. Редактору забороняє встановлювати `REVIEWED`.
10. Рецензенту дозволяє лише затвердити вже збережений текст без його зміни.

#### `updateTranslationComment(...)`

Перевіряє проєкт і переклад, приймає примітку довжиною до 2000 символів та зберігає її окремо від тексту й статусу перекладу. Порожня примітка видаляє попередній коментар.

### `server/src/controllers/exportController.js`

#### `exportLocale(...)`

Перевіряє проєкт і код, знаходить цільову локаль із перекладами, сортує ключі, замінює відсутні значення на порожні рядки, відновлює вкладений JSON і додає ім'я файла в `Content-Disposition`.

## 12. Сервер: сервіс імпорту

### `server/src/services/sourceImportService.js`

Сервіс містить предметну логіку, яка складніша за звичайне прийняття HTTP-запиту.

#### `importSourceTexts(project, content, options)`

1. `flattenLocalizationObject()` перетворює вкладений JSON на масив.
2. Порожній файл відхиляється.
3. Усе виконується в транзакції.
4. Обирається сторінка або створюється нова за `pageName`.
5. Створюється наступна `PageVersion` з власними ключами та перекладами.
6. Незмінний оригінал отримує копію попереднього перекладу та статусу.
7. Змінений оригінал отримує попередній переклад зі статусом `OUTDATED`.
8. Нові ключі мають порожні переклади; відсутні ключі не копіюються.
9. Попередня версія залишається незмінною. Повертаються її наступник та статистика імпорту.

## 13. Сервер: допоміжні функції

### `server/src/utils/flattenLocalization.js`

`flattenLocalizationObject(value, prefix)` рекурсивно перетворює:

```json
{ "auth": { "login": "Log in" } }
```

на:

```js
[{ key: 'auth.login', value: 'Log in' }]
```

Рекурсія означає, що функція викликає сама себе для вкладених об'єктів. Масиви, числа й порожні рядки заборонені.

### `server/src/utils/buildLocalizationObject.js`

Робить протилежне: з `auth.login` створює вкладений об'єкт. Використовується під час експорту.

### `server/src/utils/validation.js`

- `getProjectId()` приймає лише додатне ціле число;
- `getText()` повертає очищений рядок або `''`;
- `getLocaleCode()` додатково переводить код у нижній регістр;
- `isValidLocaleCode()` перевіряє `en`, `uk`, `en-us` тощо регулярним виразом.

### `server/src/utils/sendNotFound.js`

Створює однакову відповідь `404` для відсутньої сутності.

### `server/src/middleware/errorHandler.js`

Останній обробник помилок.

- Prisma-код `P2002` означає порушення унікальності й повертає `409 Conflict`;
- інші помилки записуються в консоль і повертають `500`.

Параметр `next` присутній, навіть якщо не використовується, бо Express розпізнає error middleware за чотирма параметрами.

### `server/src/middleware/auth.js`

- `requireAuth()` хешує Bearer-токен, знаходить сесію та перевіряє строк дії;
- `requireProjectAccess()` визначає роль власника або запрошеного учасника;
- `requireProjectOwner()` захищає налаштування, імпорт, мови та команду;
- для чужого проєкту повертається `404`, щоб не розкривати факт його існування.

### `server/src/utils/passwords.js` і `sessions.js`

Паролі хешуються повільним алгоритмом `scrypt` із випадковою сіллю. Токен сесії генерується через криптографічно безпечний генератор; у базі зберігається лише SHA-256 хеш токена.

## 14. База даних і Prisma

### `server/prisma.config.ts`

Повідомляє Prisma, де лежить схема, міграції та звідки брати `DATABASE_URL`.

### `server/prisma/schema.prisma`

#### `TranslationStatus`

- `NEW` — перекладу немає;
- `TRANSLATED` — переклад збережений;
- `REVIEWED` — перевірений;
- `OUTDATED` — оригінал змінився після перекладу.

#### `ProjectRole`

- `EDITOR` — змінює переклади, але не затверджує їх;
- `REVIEWER` — затверджує вже збережений текст, але не переписує його;
- власник керує проєктом, але не редагує і не затверджує переклади;
- власник визначається через `Project.ownerId`, тому окреме значення `OWNER` в enum не потрібне.

#### `User`

Обліковий запис із ім'ям, унікальним email і хешем пароля. Пов'язаний із власними проєктами та активними сесіями.

#### `Session`

Серверна сесія з хешем токена і строком дії. Видаляється каскадно разом із користувачем.

#### `Project`

Проєкт із назвою, описом, кодом мови оригіналу, локалями й ключами. `ownerId` визначає користувача, який може його читати та змінювати.

#### `ProjectMember`

Зв'язує користувача з проєктом і зберігає його роль. Унікальність `[projectId, userId]` не дозволяє додати одну людину двічі до тієї самої команди.

#### `Locale`

Мова конкретного проєкту. `isSource` відрізняє оригінал від мов перекладу.

`@@unique([projectId, code])` не дозволяє додати один код двічі в одному проєкті.

#### `TranslationKey`

Стабільний технічний ключ, наприклад `auth.login`.

#### `SourceText`

Версія оригінального тексту. Старі версії не видаляються, а отримують `isCurrent: false`.

#### `Translation`

Переклад одного ключа однією мовою. Містить текст, статус і версію оригіналу, для якої його зроблено.

#### Зв'язки

```text
Project
├── Locale
└── TranslationKey
    ├── SourceText (версії оригіналу)
    └── Translation
        └── Locale
```

`onDelete: Cascade` означає: після видалення проєкту база автоматично видалить його залежні дані.

### `server/prisma/migrations/`

Історія змін структури бази у вигляді SQL. Її не редагують після застосування — для нової зміни створюють нову міграцію.

## 15. Інші файли

### `examples/en.json`

Тестовий файл локалізації для ручної перевірки імпорту.

### `package-lock.json`

Автоматично фіксує точні версії залежностей. Вручну не редагується.

### `client/dist/`

Результат `npm run build`. Це згенеровані файли, а не місце для редагування коду.

### `node_modules/`

Завантажені бібліотеки. Вручну не редагуються й зазвичай не додаються до Git.

### `.env`

Локальні секретні налаштування, зокрема `DATABASE_URL`. Його значення не публікують у Git або документації.

## 16. У якому порядку вивчати код

1. `client/index.html`
2. `client/src/main.jsx`
3. `client/src/App.jsx`
4. `client/src/pages/AuthPage.jsx`
5. `client/src/pages/ProjectsPage.jsx`
6. `client/src/components/projects/CreateProjectForm.jsx`
7. `client/src/components/projects/EditProjectForm.jsx`
8. `client/src/components/projects/LocaleManager.jsx`
9. `client/src/components/projects/ProjectMembers.jsx`
10. `client/src/api/localizationApi.js`
11. `server/src/server.js`
12. `server/src/app.js`
13. `server/src/routes/auth.js`
14. `server/src/middleware/auth.js`
15. `server/src/controllers/authController.js`
16. `server/src/routes/projects.js`
17. `server/src/controllers/projectsController.js`
18. `server/src/controllers/membersController.js`
19. `server/prisma/schema.prisma`
20. `client/src/pages/ProjectEditorPage.jsx`
21. `client/src/components/projects/TranslationTable.jsx`
22. решта контролерів, сервісів і utils

Не потрібно одразу запам'ятовувати синтаксис. Спочатку для кожної функції відповідай на три питання:

1. Що вона отримує?
2. Що вона робить?
3. Що вона повертає або змінює?

## 17. Що в проєкті головне, а що другорядне

### Головний ланцюжок клієнта

```text
index.html
→ main.jsx
→ App.jsx
→ ProjectsPage.jsx або ProjectEditorPage.jsx
→ компоненти
→ localizationApi.js
```

Найважливіший файл інтерфейсу зараз — `ProjectEditorPage.jsx`. Він володіє даними відкритого проєкту й координує інші частини екрана. `TranslationTable.jsx` відповідає лише за таблицю, а `localizationApi.js` — лише за зв'язок із сервером.

### Головний ланцюжок сервера

```text
server.js
→ app.js
→ routes/projects.js
→ controller
→ service або Prisma
→ PostgreSQL
```

Маршрут лише обирає потрібну функцію. Контролер працює з HTTP-запитом. Сервіс виконує складну предметну логіку. `prisma.js` дає всім цим файлам доступ до бази.

### Допоміжні файли

- `utils/` — невеликі функції, які можна використовувати в різних контролерах;
- `styles/` та `index.css` — тільки зовнішній вигляд;
- `examples/en.json` — тестові дані;
- `README.md` — коротка інструкція запуску.

### Згенеровані файли

- `package-lock.json`;
- `client/dist/`;
- `node_modules/`;
- уже створені SQL-файли у `prisma/migrations/`.

Їх потрібно зберігати або використовувати, але не вивчати як основну програмну логіку і не редагувати вручну.

## 18. Повні маршрути основних дій

### Реєстрація та перший вхід

```text
AuthPage.handleSubmit()
→ API registerUser()
→ POST /api/auth/register
→ authController.register()
→ passwords.hashPassword()
→ таблиці User і Session
→ перший користувач отримує проєкти без власника
→ токен зберігається в localStorage
→ App показує ProjectsPage
```

### Перевірка доступу до проєкту

```text
HTTP-запит із Bearer-токеном
→ requireAuth()
→ перевірка Session та expiresAt
→ requireProjectAccess()
→ пошук Project.ownerId або ProjectMember
→ контролер проєкту або відповідь 404
```

### Додавання учасника

```text
власник відкриває «Учасники»
→ вводить email і вибирає роль
→ POST /api/projects/:id/members
→ requireAuth() і requireProjectOwner()
→ membersController.addMember()
→ пошук зареєстрованого User за email
→ створення ProjectMember
→ проєкт з'являється у списку запрошеного користувача
```

### Створення проєкту

```text
CreateProjectForm.handleSubmit()
→ ProjectsPage.handleCreateProject()
→ API createProject()
→ POST /api/projects
→ projectsController.createProject()
→ prisma.project.create()
→ таблиці Project і Locale
→ повернення project.id
→ App.navigate('/projects/' + id)
→ ProjectEditorPage
```

Разом із проєктом сервер автоматично створює початкову локаль, наприклад `en / English / isSource=true`.

### Додавання української мови

```text
форма locale-create-bar
→ handleAddLocale()
→ API createLocale()
→ POST /api/projects/:id/locales
→ localesController.addLocale()
→ транзакція Prisma
→ створення Locale
→ створення порожнього Translation для кожного наявного ключа
→ loadProject()
```

Тому порядок «спочатку імпорт, потім мова» також працює: під час додавання мови порожні переклади будуть створені для вже імпортованих ключів.

### Імпорт англійського JSON

```text
користувач вибирає файл
→ handleFileChange()
→ file.text()
→ JSON.parse()
→ API importSourceFile()
→ POST /api/projects/:id/import
→ importController.importSourceFile()
→ sourceImportService.importSourceTexts()
→ flattenLocalizationObject()
→ Prisma-транзакція
→ TranslationKey + SourceText + Translation
→ статистика created/updated/unchanged
→ loadProject()
```

`JSON.parse()` працює ще у браузері. Сервер отримує вже JavaScript/JSON-об'єкт, але все одно перевіряє його структуру.

### Пошук і фільтрація

```text
поле пошуку або кнопка статусу
→ setQuery() або setStatusFilter()
→ React повторно виконує ProjectEditorPage()
→ useMemo формує visibleKeys
→ TranslationTable отримує новий масив
```

Тут запиту до сервера немає. Усі потрібні ключі вже завантажені в `project` і фільтруються у браузері.

### Збереження перекладу

```text
TranslationRow.save()
→ ProjectEditorPage.handleSaveTranslation()
→ API updateTranslation()
→ PATCH /api/projects/:projectId/translations/:translationId
→ translationsController.updateTranslation()
→ prisma.translation.update()
→ replaceTranslation()
→ React перемальовує рядок і лічильники
```

### Збереження коментаря

```text
форма в правій панелі
→ ProjectEditorPage.handleSaveComment()
→ API updateTranslationComment()
→ PATCH /api/projects/:projectId/translations/:translationId/comment
→ translationsController.updateTranslationComment()
→ prisma.translation.update()
→ replaceTranslation()
→ React показує збережену примітку
```

### Повторний імпорт зміненого оригіналу

```text
новий файл оригіналу для вибраної сторінки
→ PageImport показує різницю
→ sourceImportService створює нову PageVersion
→ створюються незалежні TranslationKey, SourceText, Translation
→ змінені переклади отримують OUTDATED; попередня версія не змінюється
```

Так програма пам'ятає, що переклад був зроблений для старої версії оригіналу.

### Експорт українського JSON

```text
handleExport()
→ API downloadLocaleFile()
→ GET /api/projects/:id/export/uk
→ exportController.exportLocale()
→ Prisma отримує переклади й ключі
→ buildLocalizationObject()
→ сервер повертає JSON
→ браузер отримує Blob
→ тимчасове посилання запускає завантаження uk.json
```

## 19. Як один переклад виглядає на різних рівнях

У початковому файлі:

```json
{
  "auth": {
    "login": "Log in"
  }
}
```

Після `flattenLocalizationObject()`:

```js
{ key: 'auth.login', value: 'Log in' }
```

Приблизно так він представлений у даних відкритого проєкту:

```js
{
  id: 10,
  key: 'auth.login',
  sourceTexts: [
    { value: 'Log in', version: 1, isCurrent: true }
  ],
  translations: [
    {
      id: 25,
      value: 'Увійти',
      status: 'TRANSLATED',
      sourceVersion: 1,
      locale: { code: 'uk', name: 'Українська' }
    }
  ]
}
```

Під час експорту `buildLocalizationObject()` знову перетворює `auth.login` на вкладений JSON:

```json
{
  "auth": {
    "login": "Увійти"
  }
}
```

## 20. Словник параметрів і конструкцій, які часто зустрічаються

### `req`, `res`, `next`

Це параметри Express-контролера:

- `req` — вхідний запит: адреса, параметри й тіло;
- `res` — об'єкт для формування відповіді;
- `next(error)` — передати помилку наступному обробнику.

```js
req.params.projectId // значення :projectId з адреси
req.body.name        // поле name з JSON-тіла
res.status(201).json(project) // повернути JSON зі статусом 201
```

### Callback — функція, передана іншій функції

```jsx
<CreateProjectForm onCreate={handleCreateProject} />
```

Форма отримує `handleCreateProject` під назвою `onCreate` і може викликати її. Це дозволяє формі не знати деталей API.

### Деструктуризація

```js
function CreateProjectForm({ isSaving, onCreate })
```

Це короткий запис замість:

```js
function CreateProjectForm(props) {
  const isSaving = props.isSaving
  const onCreate = props.onCreate
}
```

### Spread `...`

```js
{ ...currentProject, translationKeys: newKeys }
```

Створює новий об'єкт із полями старого, а вказане після spread поле замінює. Це важливо для безпечного оновлення React-стану.

### HTTP-методи та статуси

- `GET` — прочитати;
- `POST` — створити або запустити дію;
- `PATCH` — частково оновити;
- `200` — успішно;
- `201` — створено;
- `400` — неправильні вхідні дані;
- `404` — сутність не знайдена;
- `409` — конфлікт, наприклад дубль;
- `500` — неочікувана помилка сервера.
