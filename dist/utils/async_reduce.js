"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function default_1(array, callbackfn, initialValue) {
    const result = await array.reduce(async (a, b, c, d) => {
        const accum = await a;
        return callbackfn(accum, b, c, d);
    }, Promise.resolve(initialValue));
    return result;
}
exports.default = default_1;
