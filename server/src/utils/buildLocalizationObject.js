// Цей файл відновлює вкладений об'єкт локалізації з плоских ключів.

// Будує вкладену структуру JSON із записів, ключі яких розділені крапками.
function buildLocalizationObject(entries) {
    // Object.create(null) не має службових полів на кшталт __proto__,
    // тому ключі з файлу не можуть випадково змінити прототип об'єкта.
    const result = Object.create(null);

    for (const { key, value } of entries) {
        const parts = key.split(".");
        let current = result;

        parts.forEach((part, index) => {
            const isLastPart = index === parts.length - 1;

            if (isLastPart) {
                current[part] = value;
                return;
            }

            if (!current[part] || typeof current[part] !== "object") {
                current[part] = Object.create(null);
            }

            current = current[part];
        });
    }

    return result;
}

module.exports = { buildLocalizationObject };
