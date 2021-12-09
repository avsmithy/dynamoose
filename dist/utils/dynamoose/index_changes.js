"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableIndexChangeType = void 0;
const obj = require("js-object-utilities");
const Internal = require("../../Internal");
const { internalProperties } = Internal.General;
var TableIndexChangeType;
(function (TableIndexChangeType) {
    TableIndexChangeType["add"] = "add";
    TableIndexChangeType["delete"] = "delete";
})(TableIndexChangeType = exports.TableIndexChangeType || (exports.TableIndexChangeType = {}));
const index_changes = async (table, existingIndexes = []) => {
    const output = [];
    const expectedIndexes = await table.getInternalProperties(internalProperties).getIndexes();
    // Indexes to delete
    const identiticalProperties = ["IndexName", "KeySchema", "Projection", "ProvisionedThroughput"]; // This array represents the properties in the indexes that should match between existingIndexes (from DynamoDB) and expectedIndexes. This array will not include things like `IndexArn`, `ItemCount`, etc, since those properties do not exist in expectedIndexes
    const deleteIndexes = existingIndexes.filter((index) => !(expectedIndexes.GlobalSecondaryIndexes || []).find((searchIndex) => obj.equals(obj.pick(index, identiticalProperties), obj.pick(searchIndex, identiticalProperties)))).map((index) => ({ "name": index.IndexName, "type": TableIndexChangeType.delete }));
    output.push(...deleteIndexes);
    // Indexes to create
    const createIndexes = (expectedIndexes.GlobalSecondaryIndexes || []).filter((index) => ![...output.map((i) => i.name), ...existingIndexes.map((i) => i.IndexName)].includes(index.IndexName)).map((index) => ({
        "type": TableIndexChangeType.add,
        "spec": index
    }));
    output.push(...createIndexes);
    return output;
};
exports.default = index_changes;
