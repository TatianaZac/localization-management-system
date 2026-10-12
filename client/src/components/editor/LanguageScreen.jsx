// Окремий екран показує базову й цільові мови та дії власника над ними.

import LocaleManager from '../projects/LocaleManager'
import AVAILABLE_LANGUAGES from '../../data/languages'

export default function LanguageScreen({
  canManageProject,
  isSaving,
  localeCode,
  onAddLocale,
  onDeleteLocale,
  onLanguageChange,
  onOpenLocale,
  onRenameLocale,
  onToggleForm,
  pageCount,
  project,
  selectedLocaleCode,
  showLocaleForm
}) {
  const usedCodes = new Set(project.locales.map((locale) => locale.code.toLowerCase()))
  const languagesToAdd = AVAILABLE_LANGUAGES.filter((language) => !usedCodes.has(language.code))

  return (
    <section className="language-screen">
      <div className="project-title-row">
        <div>
          <h1>Мови проєкту</h1>
          <p>Обирайте мову, щоб працювати з її перекладами у файлах проєкту.</p>
        </div>
        {canManageProject && (
          <button className="button primary" onClick={onToggleForm} type="button">
            + Додати мову
          </button>
        )}
      </div>
      <div className="source-language-info">
        <span aria-hidden="true">ⓘ</span>
        <div>
          <strong>Базова мова не редагується</strong>
          <small>
            Вона використовується як джерело текстів. Власник може додавати будь-які потрібні
            цільові мови.
          </small>
        </div>
      </div>
      {canManageProject && showLocaleForm && (
        <form className="locale-create-bar" onSubmit={onAddLocale}>
          <div>
            <strong>Нова цільова мова</strong>
            <small>Додайте будь-яку мову, потрібну саме цьому проєкту.</small>
          </div>
          <label className="locale-create-select">
            Мова
            <select
              aria-label="Нова цільова мова"
              onChange={(event) => {
                const language = AVAILABLE_LANGUAGES.find(
                  (item) => item.code === event.target.value
                )
                onLanguageChange(language ?? null)
              }}
              required
              value={localeCode}
            >
              <option value="">Обери мову</option>
              {languagesToAdd.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name} ({language.code.toUpperCase()})
                </option>
              ))}
            </select>
          </label>
          <button className="button primary" disabled={isSaving || !localeCode} type="submit">
            Додати
          </button>
        </form>
      )}
      <LocaleManager
        isOwner={canManageProject}
        isSaving={isSaving}
        localeStats={project.localeStats}
        locales={project.locales}
        onDelete={onDeleteLocale}
        onOpen={onOpenLocale}
        onRename={onRenameLocale}
        pageCount={pageCount}
        selectedLocaleCode={selectedLocaleCode}
        translationKeys={project.translationKeys}
      />
    </section>
  )
}
