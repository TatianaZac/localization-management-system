export const GLOSSARY_STATUS_LABELS = {
  APPROVED: 'Затверджено',
  PENDING: 'На погодженні',
  ARCHIVED: 'Архів'
}

export const EMPTY_GLOSSARY_FORM = {
  term: '',
  definition: '',
  translation: '',
  note: '',
  example: ''
}

export function formatGlossaryDate(value) {
  return value ? new Date(value).toLocaleString('uk-UA') : '—'
}

export function formatGlossaryShortDate(value) {
  return value ? new Date(value).toLocaleDateString('uk-UA') : '—'
}
