import '../../styles/TranslationTable.css'

function statusLabel(status) {
  const labels = {
    NEW: 'Новий',
    TRANSLATED: 'Перекладено',
    REVIEWED: 'Перевірено',
    OUTDATED: 'Застаріло',
  }

  return labels[status]
}

function TranslationTable({ translationKeys }) {
  return (
    <section className="table-card">
      <div className="table-heading">
        <div>
          <p className="eyebrow">Поточна версія</p>
          <h2>Рядки локалізації</h2>
        </div>
        <span>{translationKeys.length} ключів</span>
      </div>

      {translationKeys.length === 0 ? (
        <p className="empty-table">Імпортуй англомовний JSON, щоб побачити ключі тут.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ключ</th>
                <th>Оригінал</th>
                <th>Переклади</th>
              </tr>
            </thead>
            <tbody>
              {translationKeys.map((translationKey) => (
                <tr key={translationKey.id}>
                  <td><code>{translationKey.key}</code></td>
                  <td>
                    <span>{translationKey.sourceTexts[0]?.value}</span>
                    <small>Версія {translationKey.sourceTexts[0]?.version}</small>
                  </td>
                  <td>
                    {translationKey.translations.length === 0 && (
                      <span className="no-translations">Ще немає мов перекладу</span>
                    )}
                    {translationKey.translations.map((translation) => (
                      <div className="translation-row" key={translation.id}>
                        <span className="locale-code">{translation.locale.code}</span>
                        <span>{translation.value ?? 'Ще не перекладено'}</span>
                        <span className={'status ' + translation.status.toLowerCase()}>
                          {statusLabel(translation.status)}
                        </span>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default TranslationTable
