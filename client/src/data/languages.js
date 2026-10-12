// Тут зберігається лише довідник для випадаючого списку.
// Мови, які власник додасть до проєкту, окремо зберігаються в базі.
const AVAILABLE_LANGUAGES = [
  { code: 'uk', name: 'Українська' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Німецька' },
  { code: 'pl', name: 'Польська' },
  { code: 'fr', name: 'Французька' },
  { code: 'es', name: 'Іспанська' },
  { code: 'it', name: 'Італійська' },
  { code: 'pt', name: 'Португальська' },
  { code: 'nl', name: 'Нідерландська' },
  { code: 'cs', name: 'Чеська' },
  { code: 'sk', name: 'Словацька' },
  { code: 'ro', name: 'Румунська' },
  { code: 'bg', name: 'Болгарська' },
  { code: 'hu', name: 'Угорська' },
  { code: 'tr', name: 'Турецька' },
  { code: 'sv', name: 'Шведська' },
  { code: 'da', name: 'Данська' },
  { code: 'fi', name: 'Фінська' },
  { code: 'no', name: 'Норвезька' },
  { code: 'el', name: 'Грецька' },
  { code: 'ja', name: 'Японська' },
  { code: 'ko', name: 'Корейська' },
  { code: 'zh', name: 'Китайська' }
]

export default AVAILABLE_LANGUAGES
