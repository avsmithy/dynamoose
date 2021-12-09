"use strict";
const Internal = require("./Internal");
module.exports = {
    "UNDEFINED": Internal.Public.undefined,
    "THIS": Internal.Public.this,
    "NULL": Internal.Public.null,
    "ANY": Internal.Public.any,
    "CONSTANT": (value) => ({
        "value": "Constant",
        "settings": {
            value
        }
    }),
    "COMBINE": (attributes, separator) => {
        const settings = { attributes };
        if (separator) {
            settings.separator = separator;
        }
        return {
            "value": "Combine",
            settings
        };
    }
};
