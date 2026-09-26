// Цей файл містить спільні функції перевірки й нормалізації параметрів API.

// Перетворює додатний цілочисельний параметр на число або повертає null.
function getProjectId(value) {
    if (!/^[1-9]\d*$/.test(value)) {
        return null;
    }

    return Number(value);
}

// Нормалізує довільне значення до обрізаного текстового рядка.
function getText(value) {
    return typeof value === "string" ? value.trim() : "";
}

// Нормалізує код локалі до нижнього регістру.
function getLocaleCode(value) {
    return getText(value).toLowerCase();
}

// Перевіряє, чи відповідає код локалі підтримуваному формату.
function isValidLocaleCode(code) {
    return /^[a-z]{2,3}(-[a-z]{2})?$/.test(code);
}

module.exports = {
    getProjectId,
    getText,
    getLocaleCode,
    isValidLocaleCode
};
