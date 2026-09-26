// Цей файл перетворює вкладений об'єкт локалізації на плоский список ключів і значень.

// Рекурсивно розгортає вкладені ключі JSON у записи з крапковими шляхами.
function flattenLocalizationObject(value, prefix = "") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Localization file must contain a JSON object");
    }

    const entries = [];

    for (const [key, child] of Object.entries(value)) {
        const fullKey = prefix ? prefix + "." + key : key;

        if (typeof child === "string") {
            if (!child.trim()) {
                throw new Error("Value for key " + fullKey + " cannot be empty");
            }

            entries.push({ key: fullKey, value: child });
            continue;
        }

        if (child && typeof child === "object" && !Array.isArray(child)) {
            entries.push(...flattenLocalizationObject(child, fullKey));
            continue;
        }

        throw new Error("Value for key " + fullKey + " must be a string or an object");
    }

    return entries;
}

module.exports = { flattenLocalizationObject };
