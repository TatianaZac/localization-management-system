function getProjectId(value) {
    if (!/^[1-9]\d*$/.test(value)) {
        return null;
    }

    return Number(value);
}

function getText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function getLocaleCode(value) {
    return getText(value).toLowerCase();
}

function isValidLocaleCode(code) {
    return /^[a-z]{2,3}(-[a-z]{2})?$/.test(code);
}

module.exports = {
    getProjectId,
    getText,
    getLocaleCode,
    isValidLocaleCode
};
