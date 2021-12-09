"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Model = void 0;
const CustomError = require("../Error");
const Schema_1 = require("../Schema");
const Item_1 = require("../Item");
const utils = require("../utils");
const ddb = require("../aws/ddb/internal");
const Internal = require("../Internal");
const Serializer_1 = require("../Serializer");
const ItemRetriever_1 = require("../ItemRetriever");
const Populate_1 = require("../Populate");
const type = require("../type");
const InternalPropertiesClass_1 = require("../InternalPropertiesClass");
const { internalProperties } = Internal.General;
// Model represents a single entity (ex. User, Movie, Video, Order)
class Model extends InternalPropertiesClass_1.InternalPropertiesClass {
    constructor(name, schema, ModelStore) {
        super();
        Object.defineProperty(this, "name", {
            "configurable": false,
            "value": name
        });
        // Methods
        this.setInternalProperties(internalProperties, {
            "getIndexes": async () => {
                return (await Promise.all(this.getInternalProperties(internalProperties).schemas.map((schema) => schema.getIndexes(this)))).reduce((result, indexes) => {
                    Object.entries(indexes).forEach(([key, value]) => {
                        if (key === "TableIndex") {
                            result[key] = value;
                        }
                        else {
                            result[key] = result[key] ? utils.unique_array_elements([...result[key], ...value]) : value;
                        }
                    });
                    return result;
                }, {});
            },
            "convertObjectToKey": (key) => {
                let keyObject;
                const hashKey = this.getInternalProperties(internalProperties).getHashKey();
                if (typeof key === "object") {
                    const rangeKey = this.getInternalProperties(internalProperties).getRangeKey();
                    keyObject = {
                        [hashKey]: key[hashKey]
                    };
                    if (rangeKey && typeof key[rangeKey] !== "undefined" && key[rangeKey] !== null) {
                        keyObject[rangeKey] = key[rangeKey];
                    }
                }
                else {
                    keyObject = {
                        [hashKey]: key
                    };
                }
                return keyObject;
            },
            "schemaCorrectnessScores": (object) => {
                const schemaCorrectnessScores = this.getInternalProperties(internalProperties).schemas.map((schema) => schema.getTypePaths(object, { "type": "toDynamo", "includeAllProperties": true })).map((obj) => Object.values(obj).map((obj) => { var _a; return ((_a = obj) === null || _a === void 0 ? void 0 : _a.matchCorrectness) || 0; })).map((array) => Math.min(...array));
                return schemaCorrectnessScores;
            },
            // This function returns the best matched schema for the given object input
            "schemaForObject": async (object) => {
                const schemaCorrectnessScores = this.getInternalProperties(internalProperties).schemaCorrectnessScores(object);
                const highestSchemaCorrectnessScoreIndex = schemaCorrectnessScores.indexOf(Math.max(...schemaCorrectnessScores));
                return this.getInternalProperties(internalProperties).schemas[highestSchemaCorrectnessScoreIndex];
            },
            "getCreateTableAttributeParams": async () => {
                // TODO: implement this
                return this.getInternalProperties(internalProperties).schemas[0].getCreateTableAttributeParams(this);
            },
            "getHashKey": () => {
                return this.getInternalProperties(internalProperties).schemas[0].getHashKey();
            },
            "getRangeKey": () => {
                return this.getInternalProperties(internalProperties).schemas[0].getRangeKey();
            },
            "table": () => {
                const table = this.getInternalProperties(internalProperties)._table;
                if (!table) {
                    throw new CustomError.OtherError(`No table has been registered for ${this.name} model. Use \`new dynamoose.Table\` to register a table for this model.`);
                }
                return table;
            },
            "schemas": []
        });
        let realSchemas;
        if (!schema || Array.isArray(schema) && schema.length === 0) {
            throw new CustomError.MissingSchemaError(`Schema hasn't been registered for model "${name}".\nUse "dynamoose.model(name, schema)"`);
        }
        else if (!(schema instanceof Schema_1.Schema)) {
            if (Array.isArray(schema)) {
                realSchemas = schema.map((schema) => schema instanceof Schema_1.Schema ? schema : new Schema_1.Schema(schema));
            }
            else {
                realSchemas = [new Schema_1.Schema(schema)];
            }
        }
        else {
            realSchemas = [schema];
        }
        if (!utils.all_elements_match(realSchemas.map((schema) => schema.getHashKey()))) {
            throw new CustomError.InvalidParameter("hashKey's for all schema's must match.");
        }
        if (!utils.all_elements_match(realSchemas.map((schema) => schema.getRangeKey()).filter((key) => Boolean(key)))) {
            throw new CustomError.InvalidParameter("rangeKey's for all schema's must match.");
        }
        this.setInternalProperties(internalProperties, Object.assign(Object.assign({}, this.getInternalProperties(internalProperties)), { "schemas": realSchemas }));
        const self = this;
        class Item extends Item_1.Item {
            constructor(object = {}, settings = {}) {
                super(self, utils.deep_copy(object), settings);
            }
        }
        Item.Model = self;
        this.Item = Item;
        this.serializer = new Serializer_1.Serializer();
        this.Item.transaction = [
            // `function` Default: `this[key]`
            // `settingsIndex` Default: 1
            // `dynamoKey` Default: utils.capitalize_first_letter(key)
            { "key": "get" },
            { "key": "create", "dynamoKey": "Put" },
            { "key": "delete" },
            { "key": "update", "settingsIndex": 2, "modifier": (response) => {
                    delete response.ReturnValues;
                    return response;
                } },
            { "key": "condition", "settingsIndex": -1, "dynamoKey": "ConditionCheck", "function": async (key, condition) => (Object.assign({ "Key": this.Item.objectToDynamo(this.getInternalProperties(internalProperties).convertObjectToKey(key)), "TableName": this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name }, condition ? await condition.requestObject(this) : {})) }
        ].reduce((accumulator, currentValue) => {
            const { key, modifier } = currentValue;
            const dynamoKey = currentValue.dynamoKey || utils.capitalize_first_letter(key);
            const settingsIndex = currentValue.settingsIndex || 1;
            const func = currentValue.function || this[key].bind(this);
            accumulator[key] = async (...args) => {
                if (typeof args[args.length - 1] === "function") {
                    console.warn("Dynamoose Warning: Passing callback function into transaction method not allowed. Removing callback function from list of arguments.");
                    args.pop();
                }
                if (settingsIndex >= 0) {
                    args[settingsIndex] = utils.merge_objects({ "return": "request" }, args[settingsIndex] || {});
                }
                let result = await func(...args);
                if (modifier) {
                    result = modifier(result);
                }
                return { [dynamoKey]: result };
            };
            return accumulator;
        }, {});
        ModelStore(this);
    }
    batchGet(keys, settings, callback) {
        if (typeof settings === "function") {
            callback = settings;
            settings = { "return": "items" };
        }
        if (typeof settings === "undefined") {
            settings = { "return": "items" };
        }
        const keyObjects = keys.map((key) => this.getInternalProperties(internalProperties).convertObjectToKey(key));
        const itemify = (item) => new this.Item(item, { "type": "fromDynamo" }).conformToSchema({ "customTypesDynamo": true, "checkExpiredItem": true, "saveUnknown": true, "modifiers": ["get"], "type": "fromDynamo" });
        const prepareResponse = async (response) => {
            const tmpResult = await Promise.all(response.Responses[this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name].map((item) => itemify(item)));
            const unprocessedArray = response.UnprocessedKeys[this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name] ? response.UnprocessedKeys[this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name].Keys : [];
            const tmpResultUnprocessed = await Promise.all(unprocessedArray.map((item) => this.Item.fromDynamo(item)));
            const startArray = Object.assign([], {
                "unprocessedKeys": [],
                "populate": Populate_1.PopulateItems,
                "toJSON": utils.dynamoose.itemToJSON
            });
            return keyObjects.reduce((result, key) => {
                const keyProperties = Object.keys(key);
                const item = tmpResult.find((item) => keyProperties.every((keyProperty) => item[keyProperty] === key[keyProperty]));
                if (item) {
                    result.push(item);
                }
                else {
                    const item = tmpResultUnprocessed.find((item) => keyProperties.every((keyProperty) => item[keyProperty] === key[keyProperty]));
                    if (item) {
                        result.unprocessedKeys.push(item);
                    }
                }
                return result;
            }, startArray);
        };
        const getParams = async (settings) => {
            const params = {
                "RequestItems": {
                    [this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name]: {
                        "Keys": await Promise.all(keyObjects.map(async (key) => this.Item.objectToDynamo(await this.Item.objectFromSchema(key, this, { "type": "toDynamo", "modifiers": ["set"], "typeCheck": false }))))
                    }
                }
            };
            if (settings.attributes) {
                params.RequestItems[this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name].AttributesToGet = settings.attributes;
            }
            return params;
        };
        if (settings.return === "request") {
            if (callback) {
                const localCallback = callback;
                getParams(settings).then((params) => localCallback(null, params)).catch((err) => localCallback(err));
                return;
            }
            else {
                return (async () => {
                    const response = await getParams(settings);
                    return response;
                })();
            }
        }
        const promise = this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).pendingTaskPromise().then(() => getParams(settings)).then((params) => ddb("batchGetItem", params));
        if (callback) {
            const localCallback = callback;
            promise.then((response) => prepareResponse(response)).then((response) => localCallback(null, response)).catch((error) => localCallback(error));
        }
        else {
            return (async () => {
                const response = await promise;
                return prepareResponse(response);
            })();
        }
    }
    batchPut(items, settings, callback) {
        if (typeof settings === "function") {
            callback = settings;
            settings = { "return": "response" };
        }
        if (typeof settings === "undefined") {
            settings = { "return": "response" };
        }
        const prepareResponse = async (response) => {
            const unprocessedArray = response.UnprocessedItems && response.UnprocessedItems[this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name] ? response.UnprocessedItems[this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name] : [];
            const tmpResultUnprocessed = await Promise.all(unprocessedArray.map((item) => this.Item.fromDynamo(item.PutRequest.Item)));
            return items.reduce((result, item) => {
                const unprocessedItem = tmpResultUnprocessed.find((searchItem) => Object.keys(item).every((keyProperty) => searchItem[keyProperty] === item[keyProperty]));
                if (unprocessedItem) {
                    result.unprocessedItems.push(unprocessedItem);
                }
                return result;
            }, { "unprocessedItems": [] });
        };
        const paramsPromise = (async () => ({
            "RequestItems": {
                [this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name]: await Promise.all(items.map(async (item) => ({
                    "PutRequest": {
                        "Item": await new this.Item(item).toDynamo({ "defaults": true, "validate": true, "required": true, "enum": true, "forceDefault": true, "saveUnknown": true, "combine": true, "customTypesDynamo": true, "updateTimestamps": true, "modifiers": ["set"] })
                    }
                })))
            }
        }))();
        if (settings.return === "request") {
            if (callback) {
                const localCallback = callback;
                paramsPromise.then((result) => localCallback(null, result));
                return;
            }
            else {
                return paramsPromise;
            }
        }
        const promise = this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).pendingTaskPromise().then(() => paramsPromise).then((params) => ddb("batchWriteItem", params));
        if (callback) {
            const localCallback = callback;
            promise.then((response) => prepareResponse(response)).then((response) => localCallback(null, response)).catch((error) => callback(error));
        }
        else {
            return (async () => {
                const response = await promise;
                return prepareResponse(response);
            })();
        }
    }
    batchDelete(keys, settings, callback) {
        if (typeof settings === "function") {
            callback = settings;
            settings = { "return": "response" };
        }
        if (typeof settings === "undefined") {
            settings = { "return": "response" };
        }
        const keyObjects = keys.map((key) => this.getInternalProperties(internalProperties).convertObjectToKey(key));
        const prepareResponse = async (response) => {
            const unprocessedArray = response.UnprocessedItems && response.UnprocessedItems[this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name] ? response.UnprocessedItems[this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name] : [];
            const tmpResultUnprocessed = await Promise.all(unprocessedArray.map((item) => this.Item.fromDynamo(item.DeleteRequest.Key)));
            return keyObjects.reduce((result, key) => {
                const item = tmpResultUnprocessed.find((item) => Object.keys(key).every((keyProperty) => item[keyProperty] === key[keyProperty]));
                if (item) {
                    result.unprocessedItems.push(item);
                }
                return result;
            }, { "unprocessedItems": [] });
        };
        const getParams = async () => ({
            "RequestItems": {
                [this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name]: await Promise.all(keyObjects.map(async (key) => ({
                    "DeleteRequest": {
                        "Key": this.Item.objectToDynamo(await this.Item.objectFromSchema(key, this, { "type": "toDynamo", "modifiers": ["set"], "typeCheck": false }))
                    }
                })))
            }
        });
        if (settings.return === "request") {
            if (callback) {
                const localCallback = callback;
                getParams().then((result) => localCallback(null, result)).catch((error) => callback(error));
                return;
            }
            else {
                return (async () => {
                    const response = await getParams();
                    return response;
                })();
            }
        }
        const promise = this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).pendingTaskPromise().then(() => getParams()).then((params) => ddb("batchWriteItem", params));
        if (callback) {
            const localCallback = callback;
            promise.then((response) => prepareResponse(response)).then((response) => localCallback(null, response)).catch((error) => localCallback(error));
        }
        else {
            return (async () => {
                const response = await promise;
                return prepareResponse(response);
            })();
        }
    }
    update(keyObj, updateObj, settings, callback) {
        if (typeof updateObj === "function") {
            callback = updateObj; // TODO: fix this, for some reason `updateObj` has a type of Function which is forcing us to type cast it
            updateObj = null;
            settings = { "return": "item" };
        }
        if (typeof settings === "function") {
            callback = settings;
            settings = { "return": "item" };
        }
        if (!updateObj) {
            const hashKeyName = this.getInternalProperties(internalProperties).getHashKey();
            updateObj = utils.deep_copy(keyObj);
            keyObj = {
                [hashKeyName]: keyObj[hashKeyName]
            };
            delete updateObj[hashKeyName];
            const rangeKeyName = this.getInternalProperties(internalProperties).getRangeKey();
            if (rangeKeyName) {
                keyObj[rangeKeyName] = updateObj[rangeKeyName];
                delete updateObj[rangeKeyName];
            }
        }
        if (typeof settings === "undefined") {
            settings = { "return": "item" };
        }
        const schema = this.getInternalProperties(internalProperties).schemas[0]; // TODO: fix this to get correct schema
        let index = 0;
        const getUpdateExpressionObject = async () => {
            const updateTypes = [
                { "name": "$SET", "operator": " = ", "objectFromSchemaSettings": { "validate": true, "enum": true, "forceDefault": true, "required": "nested", "modifiers": ["set"] } },
                { "name": "$ADD", "objectFromSchemaSettings": { "forceDefault": true } },
                { "name": "$REMOVE", "attributeOnly": true, "objectFromSchemaSettings": { "required": true, "defaults": true } },
                { "name": "$DELETE", "objectFromSchemaSettings": { "defaults": true } }
            ].reverse();
            const returnObject = await Object.keys(updateObj).reduce(async (accumulatorPromise, key) => {
                const accumulator = await accumulatorPromise;
                let value = updateObj[key];
                if (!(typeof value === "object" && updateTypes.map((a) => a.name).includes(key))) {
                    value = { [key]: value };
                    key = "$SET";
                }
                const valueKeys = Object.keys(value);
                for (let i = 0; i < valueKeys.length; i++) {
                    let subKey = valueKeys[i];
                    let subValue = value[subKey];
                    let updateType = updateTypes.find((a) => a.name === key);
                    const expressionKey = `#a${index}`;
                    subKey = Array.isArray(value) ? subValue : subKey;
                    let dynamoType;
                    try {
                        dynamoType = schema.getAttributeType(subKey, subValue, { "unknownAttributeAllowed": true });
                    }
                    catch (e) { } // eslint-disable-line no-empty
                    const attributeExists = schema.attributes().includes(subKey);
                    const dynamooseUndefined = type.UNDEFINED;
                    if (!updateType.attributeOnly && subValue !== dynamooseUndefined) {
                        subValue = (await this.Item.objectFromSchema({ [subKey]: dynamoType === "L" && !Array.isArray(subValue) ? [subValue] : subValue }, this, Object.assign({ "type": "toDynamo", "customTypesDynamo": true, "saveUnknown": true }, updateType.objectFromSchemaSettings)))[subKey];
                    }
                    if (subValue === dynamooseUndefined || subValue === undefined) {
                        if (attributeExists) {
                            updateType = updateTypes.find((a) => a.name === "$REMOVE");
                        }
                        else {
                            continue;
                        }
                    }
                    if (subValue !== dynamooseUndefined) {
                        const defaultValue = await schema.defaultCheck(subKey, undefined, updateType.objectFromSchemaSettings);
                        if (defaultValue) {
                            subValue = defaultValue;
                            updateType = updateTypes.find((a) => a.name === "$SET");
                        }
                    }
                    if (updateType.objectFromSchemaSettings.required === true) {
                        await schema.requiredCheck(subKey, undefined);
                    }
                    let expressionValue = updateType.attributeOnly ? "" : `:v${index}`;
                    accumulator.ExpressionAttributeNames[expressionKey] = subKey;
                    if (!updateType.attributeOnly) {
                        accumulator.ExpressionAttributeValues[expressionValue] = subValue;
                    }
                    if (dynamoType === "L" && updateType.name === "$ADD") {
                        expressionValue = `list_append(${expressionKey}, ${expressionValue})`;
                        updateType = updateTypes.find((a) => a.name === "$SET");
                    }
                    const operator = updateType.operator || (updateType.attributeOnly ? "" : " ");
                    accumulator.UpdateExpression[updateType.name.slice(1)].push(`${expressionKey}${operator}${expressionValue}`);
                    index++;
                }
                return accumulator;
            }, Promise.resolve((async () => {
                const obj = {
                    "ExpressionAttributeNames": {},
                    "ExpressionAttributeValues": {},
                    "UpdateExpression": updateTypes.map((a) => a.name).reduce((accumulator, key) => {
                        accumulator[key.slice(1)] = [];
                        return accumulator;
                    }, {})
                };
                const itemFunctionSettings = { "updateTimestamps": { "updatedAt": true }, "customTypesDynamo": true, "type": "toDynamo" };
                const defaultObjectFromSchema = await this.Item.objectFromSchema(await this.Item.prepareForObjectFromSchema({}, this, itemFunctionSettings), this, itemFunctionSettings);
                Object.keys(defaultObjectFromSchema).forEach((key) => {
                    const value = defaultObjectFromSchema[key];
                    const updateType = updateTypes.find((a) => a.name === "$SET");
                    obj.ExpressionAttributeNames[`#a${index}`] = key;
                    obj.ExpressionAttributeValues[`:v${index}`] = value;
                    obj.UpdateExpression[updateType.name.slice(1)].push(`#a${index}${updateType.operator}:v${index}`);
                    index++;
                });
                return obj;
            })()));
            schema.attributes().map((attribute) => ({ attribute, "type": schema.getAttributeTypeDetails(attribute) })).filter((item) => {
                return Array.isArray(item.type) ? item.type.some((type) => type.name === "Combine") : item.type.name === "Combine";
            }).map((details) => {
                const { type } = details;
                if (Array.isArray(type)) {
                    throw new CustomError.InvalidParameter("Combine type is not allowed to be used with multiple types.");
                }
                return details;
            }).forEach((details) => {
                const { invalidAttributes } = details.type.typeSettings.attributes.reduce((result, attribute) => {
                    const expressionAttributeNameEntry = Object.entries(returnObject.ExpressionAttributeNames).find((entry) => entry[1] === attribute);
                    const doesExist = Boolean(expressionAttributeNameEntry);
                    const isValid = doesExist && [...returnObject.UpdateExpression.SET, ...returnObject.UpdateExpression.REMOVE].join(", ").includes(expressionAttributeNameEntry[0]);
                    if (!isValid) {
                        result.invalidAttributes.push(attribute);
                    }
                    return result;
                }, { "invalidAttributes": [] });
                if (invalidAttributes.length > 0) {
                    throw new CustomError.InvalidParameter(`You must update all or none of the combine attributes when running Model.update. Missing combine attributes: ${invalidAttributes.join(", ")}.`);
                }
                else {
                    const nextIndex = Math.max(...Object.keys(returnObject.ExpressionAttributeNames).map((key) => parseInt(key.replace("#a", "")))) + 1;
                    returnObject.ExpressionAttributeNames[`#a${nextIndex}`] = details.attribute;
                    returnObject.ExpressionAttributeValues[`:v${nextIndex}`] = details.type.typeSettings.attributes.map((attribute) => {
                        const [expressionAttributeNameKey] = Object.entries(returnObject.ExpressionAttributeNames).find((entry) => entry[1] === attribute);
                        return returnObject.ExpressionAttributeValues[expressionAttributeNameKey.replace("#a", ":v")];
                    }).filter((value) => typeof value !== "undefined" && value !== null).join(details.type.typeSettings.separator);
                    returnObject.UpdateExpression.SET.push(`#a${nextIndex} = :v${nextIndex}`);
                }
            });
            await Promise.all(schema.attributes().map(async (attribute) => {
                const defaultValue = await schema.defaultCheck(attribute, undefined, { "forceDefault": true });
                if (defaultValue && !Object.values(returnObject.ExpressionAttributeNames).includes(attribute)) {
                    const updateType = updateTypes.find((a) => a.name === "$SET");
                    returnObject.ExpressionAttributeNames[`#a${index}`] = attribute;
                    returnObject.ExpressionAttributeValues[`:v${index}`] = defaultValue;
                    returnObject.UpdateExpression[updateType.name.slice(1)].push(`#a${index}${updateType.operator}:v${index}`);
                    index++;
                }
            }));
            Object.values(returnObject.ExpressionAttributeNames).map((attribute, index) => {
                const value = Object.values(returnObject.ExpressionAttributeValues)[index];
                const valueKey = Object.keys(returnObject.ExpressionAttributeValues)[index];
                let dynamoType;
                try {
                    dynamoType = schema.getAttributeType(attribute, value, { "unknownAttributeAllowed": true });
                }
                catch (e) { } // eslint-disable-line no-empty
                const attributeType = Schema_1.Schema.attributeTypes.findDynamoDBType(dynamoType);
                if ((attributeType === null || attributeType === void 0 ? void 0 : attributeType.toDynamo) && !attributeType.isOfType(value, "fromDynamo")) {
                    returnObject.ExpressionAttributeValues[valueKey] = attributeType.toDynamo(value);
                }
            });
            returnObject.ExpressionAttributeValues = this.Item.objectToDynamo(returnObject.ExpressionAttributeValues);
            if (Object.keys(returnObject.ExpressionAttributeValues).length === 0) {
                delete returnObject.ExpressionAttributeValues;
            }
            return Object.assign(Object.assign({}, returnObject), { "UpdateExpression": Object.keys(returnObject.UpdateExpression).reduce((accumulator, key) => {
                    const value = returnObject.UpdateExpression[key];
                    if (value.length > 0) {
                        return `${accumulator}${accumulator.length > 0 ? " " : ""}${key} ${value.join(", ")}`;
                    }
                    else {
                        return accumulator;
                    }
                }, "") });
        };
        const itemify = (item) => new this.Item(item, { "type": "fromDynamo" }).conformToSchema({ "customTypesDynamo": true, "checkExpiredItem": true, "type": "fromDynamo", "saveUnknown": true });
        const localSettings = settings;
        const updateItemParamsPromise = this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).pendingTaskPromise().then(async () => (Object.assign(Object.assign({ "Key": this.Item.objectToDynamo(await this.Item.objectFromSchema(this.getInternalProperties(internalProperties).convertObjectToKey(keyObj), this, { "type": "toDynamo", "modifiers": ["set"], "typeCheck": false })), "ReturnValues": localSettings.returnValues || "ALL_NEW" }, utils.merge_objects.main({ "combineMethod": "object_combine" })(localSettings.condition ? await localSettings.condition.requestObject(this, { "index": { "start": index, "set": (i) => {
                    index = i;
                } }, "conditionString": "ConditionExpression", "conditionStringType": "string" }) : {}, await getUpdateExpressionObject())), { "TableName": this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name })));
        if (settings.return === "request") {
            if (callback) {
                const localCallback = callback;
                updateItemParamsPromise.then((params) => localCallback(null, params));
                return;
            }
            else {
                return updateItemParamsPromise;
            }
        }
        const promise = updateItemParamsPromise.then((params) => ddb("updateItem", params));
        if (callback) {
            promise.then((response) => response.Attributes ? itemify(response.Attributes) : undefined).then((response) => callback(null, response)).catch((error) => callback(error));
        }
        else {
            return (async () => {
                const response = await promise;
                return response.Attributes ? await itemify(response.Attributes) : undefined;
            })();
        }
    }
    create(item, settings, callback) {
        if (typeof settings === "function" && !callback) {
            callback = settings;
            settings = {};
        }
        return new this.Item(item).save(Object.assign({ "overwrite": false }, settings), callback);
    }
    delete(key, settings, callback) {
        if (typeof settings === "function") {
            callback = settings;
            settings = { "return": null };
        }
        if (typeof settings === "undefined") {
            settings = { "return": null };
        }
        if (typeof settings === "object" && !settings.return) {
            settings = Object.assign(Object.assign({}, settings), { "return": null });
        }
        const getDeleteItemParams = async (settings) => {
            let deleteItemParams = {
                "Key": this.Item.objectToDynamo(await this.Item.objectFromSchema(this.getInternalProperties(internalProperties).convertObjectToKey(key), this, { "type": "toDynamo", "modifiers": ["set"], "typeCheck": false })),
                "TableName": this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name
            };
            if (settings.condition) {
                deleteItemParams = Object.assign(Object.assign({}, deleteItemParams), await settings.condition.requestObject(this));
            }
            return deleteItemParams;
        };
        if (settings.return === "request") {
            if (callback) {
                const localCallback = callback;
                getDeleteItemParams(settings).then((params) => localCallback(null, params)).catch((error) => localCallback(error));
                return;
            }
            else {
                return (async () => {
                    const params = await getDeleteItemParams(settings);
                    return params;
                })();
            }
        }
        const promise = this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).pendingTaskPromise().then(() => getDeleteItemParams(settings)).then((deleteItemParams) => ddb("deleteItem", deleteItemParams));
        if (callback) {
            promise.then(() => callback()).catch((error) => callback(error));
        }
        else {
            return (async () => {
                await promise;
            })();
        }
    }
    get(key, settings, callback) {
        if (typeof settings === "function") {
            callback = settings;
            settings = { "return": "item" };
        }
        if (typeof settings === "undefined") {
            settings = { "return": "item" };
        }
        const conformToSchemaSettings = { "customTypesDynamo": true, "checkExpiredItem": true, "saveUnknown": true, "modifiers": ["get"], "type": "fromDynamo" };
        const itemify = (item) => new this.Item(item, { "type": "fromDynamo" }).conformToSchema(conformToSchemaSettings);
        const getItemParamsMethod = async (settings) => {
            const getItemParams = {
                "Key": this.Item.objectToDynamo(await this.Item.objectFromSchema(this.getInternalProperties(internalProperties).convertObjectToKey(key), this, { "type": "toDynamo", "modifiers": ["set"], "typeCheck": false })),
                "TableName": this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).name
            };
            if (settings.consistent !== undefined && settings.consistent !== null) {
                getItemParams.ConsistentRead = settings.consistent;
            }
            if (settings.attributes) {
                getItemParams.ProjectionExpression = settings.attributes.map((attribute, index) => `#a${index}`).join(", ");
                getItemParams.ExpressionAttributeNames = settings.attributes.reduce((accumulator, currentValue, index) => (accumulator[`#a${index}`] = currentValue, accumulator), {});
            }
            return getItemParams;
        };
        if (settings.return === "request") {
            if (callback) {
                const localCallback = callback;
                getItemParamsMethod(settings).then((getItemParams) => localCallback(null, getItemParams)).catch((error) => localCallback(error));
                return;
            }
            else {
                return (async () => {
                    const response = await getItemParamsMethod(settings);
                    return response;
                })();
            }
        }
        const promise = this.getInternalProperties(internalProperties).table().getInternalProperties(internalProperties).pendingTaskPromise().then(async () => {
            return getItemParamsMethod(settings);
        }).then((getItemParams) => ddb("getItem", getItemParams));
        if (callback) {
            const localCallback = callback;
            promise.then((response) => response.Item ? itemify(response.Item) : undefined).then((response) => localCallback(null, response)).catch((error) => callback(error));
        }
        else {
            return (async () => {
                const response = await promise;
                return response.Item ? await itemify(response.Item) : undefined;
            })();
        }
    }
    // Serialize Many
    serializeMany(itemsArray = [], nameOrOptions) {
        return this.serializer._serializeMany(itemsArray, nameOrOptions);
    }
}
exports.Model = Model;
Model.prototype.scan = function (object) {
    return new ItemRetriever_1.Scan(this, object);
};
Model.prototype.query = function (object) {
    return new ItemRetriever_1.Query(this, object);
};
// Methods
const customMethodFunctions = (type) => {
    const entryPoint = (self) => type === "item" ? self.Item.prototype : self.Item;
    return {
        "set": function (name, fn) {
            const self = this;
            if (!entryPoint(self)[name] || entryPoint(self)[name][Internal.General.internalProperties] && entryPoint(self)[name][Internal.General.internalProperties].type === "customMethod") {
                entryPoint(self)[name] = function (...args) {
                    const bindObject = type === "item" ? this : self.Item;
                    const cb = typeof args[args.length - 1] === "function" ? args[args.length - 1] : undefined;
                    if (cb) {
                        const result = fn.bind(bindObject)(...args);
                        if (result instanceof Promise) {
                            result.then((result) => cb(null, result)).catch((err) => cb(err));
                        }
                    }
                    else {
                        return new Promise((resolve, reject) => {
                            const result = fn.bind(bindObject)(...args, (err, result) => {
                                if (err) {
                                    reject(err);
                                }
                                else {
                                    resolve(result);
                                }
                            });
                            if (result instanceof Promise) {
                                result.then(resolve).catch(reject);
                            }
                        });
                    }
                };
                entryPoint(self)[name][Internal.General.internalProperties] = { "type": "customMethod" };
            }
        },
        "delete": function (name) {
            const self = this;
            if (entryPoint(self)[name] && entryPoint(self)[name][Internal.General.internalProperties] && entryPoint(self)[name][Internal.General.internalProperties].type === "customMethod") {
                entryPoint(self)[name] = undefined;
            }
        }
    };
};
Model.prototype.methods = Object.assign(Object.assign({}, customMethodFunctions("model")), { "item": customMethodFunctions("item") });
