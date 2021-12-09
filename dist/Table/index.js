"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableUpdateOptions = exports.Table = void 0;
const dynamoose_utils_1 = require("dynamoose-utils");
const Internal = require("../Internal");
const { internalProperties } = Internal.General;
const Model_1 = require("../Model");
const defaults_1 = require("./defaults");
const utils = require("../utils");
const utilities_1 = require("./utilities");
const InternalPropertiesClass_1 = require("../InternalPropertiesClass");
// This class represents a single DynamoDB table
class Table extends InternalPropertiesClass_1.InternalPropertiesClass {
    constructor(name, models, options = {}) {
        var _a;
        super();
        // Check name argument
        if (!name) {
            throw new dynamoose_utils_1.CustomError.InvalidParameter("Name must be passed into table constructor.");
        }
        if (typeof name !== "string") {
            throw new dynamoose_utils_1.CustomError.InvalidParameterType("Name passed into table constructor should be of type string.");
        }
        // Check model argument
        if (!models) {
            throw new dynamoose_utils_1.CustomError.InvalidParameter("Models must be passed into table constructor.");
        }
        if (!Array.isArray(models) || !models.every((model) => model.Model && model.Model instanceof Model_1.Model) || models.length === 0) {
            throw new dynamoose_utils_1.CustomError.InvalidParameterType("Models passed into table constructor should be an array of models.");
        }
        const storedOptions = utils.combine_objects(options, defaults_1.custom.get(), defaults_1.original);
        this.setInternalProperties(internalProperties, {
            "options": storedOptions,
            "name": `${storedOptions.prefix}${name}${storedOptions.suffix}`,
            "originalName": name,
            // Represents if model is ready to be used for actions such as "get", "put", etc. This property being true does not guarantee anything on the DynamoDB server. It only guarantees that Dynamoose has finished the initialization steps required to allow the model to function as expected on the client side.
            "ready": false,
            // Represents if the table in DynamoDB was created prior to initialization. This will only be updated if `create` is true.
            "alreadyCreated": false,
            // Represents an array of promise resolver functions to be called when Model.ready gets set to true (at the end of the setup flow)
            "pendingTasks": [],
            // Returns a promise that will be resolved after the Model is ready. This is used in all Model operations (Model.get, Item.save) to `await` at the beginning before running the AWS SDK method to ensure the Model is setup before running actions on it.
            "pendingTaskPromise": () => {
                return this.getInternalProperties(internalProperties).ready ? Promise.resolve() : new Promise((resolve) => {
                    this.getInternalProperties(internalProperties).pendingTasks.push(resolve);
                });
            },
            "models": models.map((model) => {
                if (model.Model.getInternalProperties(internalProperties)._table) {
                    throw new dynamoose_utils_1.CustomError.InvalidParameter(`Model ${model.Model.name} has already been assigned to a table.`);
                }
                model.Model.setInternalProperties(internalProperties, Object.assign(Object.assign({}, model.Model.getInternalProperties(internalProperties)), { "_table": this }));
                return model;
            }),
            "getIndexes": async () => {
                return (await Promise.all(this.getInternalProperties(internalProperties).models.map((model) => model.Model.getInternalProperties(internalProperties).getIndexes(this)))).reduce((result, indexes) => {
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
            // This function returns the best matched model for the given object input
            "modelForObject": async (object) => {
                const models = this.getInternalProperties(internalProperties).models;
                const modelSchemaCorrectnessScores = models.map((model) => Math.max(...model.Model.getInternalProperties(internalProperties).schemaCorrectnessScores(object)));
                const highestModelSchemaCorrectnessScore = Math.max(...modelSchemaCorrectnessScores);
                const bestModelIndex = modelSchemaCorrectnessScores.indexOf(highestModelSchemaCorrectnessScore);
                return models[bestModelIndex];
            },
            "getCreateTableAttributeParams": async () => {
                // TODO: implement this
                return this.getInternalProperties(internalProperties).models[0].Model.getInternalProperties(internalProperties).getCreateTableAttributeParams(this);
            },
            "getHashKey": () => {
                return this.getInternalProperties(internalProperties).models[0].Model.getInternalProperties(internalProperties).getHashKey();
            },
            "getRangeKey": () => {
                return this.getInternalProperties(internalProperties).models[0].Model.getInternalProperties(internalProperties).getRangeKey();
            }
        });
        Object.defineProperty(this, "name", {
            "configurable": false,
            "value": this.getInternalProperties(internalProperties).name
        });
        if (!utils.all_elements_match(models.map((model) => model.Model.getInternalProperties(internalProperties).getHashKey()))) {
            throw new dynamoose_utils_1.CustomError.InvalidParameter("hashKey's for all models must match.");
        }
        if (!utils.all_elements_match(models.map((model) => model.Model.getInternalProperties(internalProperties).getRangeKey()).filter((key) => Boolean(key)))) {
            throw new dynamoose_utils_1.CustomError.InvalidParameter("rangeKey's for all models must match.");
        }
        if (options.expires) {
            if (typeof options.expires === "number") {
                options.expires = {
                    "attribute": "ttl",
                    "ttl": options.expires
                };
            }
            options.expires = utils.combine_objects(options.expires, { "attribute": "ttl" });
            utils.array_flatten(models.map((model) => model.Model.getInternalProperties(internalProperties).schemas)).forEach((schema) => {
                schema.getInternalProperties(internalProperties).schemaObject[options.expires.attribute] = {
                    "type": {
                        "value": Date,
                        "settings": {
                            "storage": "seconds"
                        }
                    },
                    "default": () => new Date(Date.now() + options.expires.ttl)
                };
            });
        }
        // Setup flow
        const setupFlow = []; // An array of setup actions to be run in order
        // Create table
        if (this.getInternalProperties(internalProperties).options.create) {
            setupFlow.push(() => (0, utilities_1.createTable)(this));
        }
        // Wait for Active
        if (this.getInternalProperties(internalProperties).options.waitForActive === true || typeof this.getInternalProperties(internalProperties).options.waitForActive === "object" && ((_a = this.getInternalProperties(internalProperties).options.waitForActive) === null || _a === void 0 ? void 0 : _a.enabled)) {
            setupFlow.push(() => (0, utilities_1.waitForActive)(this, false));
        }
        // Update Time To Live
        if ((this.getInternalProperties(internalProperties).options.create || (Array.isArray(this.getInternalProperties(internalProperties).options.update) ? this.getInternalProperties(internalProperties).options.update.includes(TableUpdateOptions.ttl) : this.getInternalProperties(internalProperties).options.update)) && options.expires) {
            setupFlow.push(() => (0, utilities_1.updateTimeToLive)(this));
        }
        // Update
        if (this.getInternalProperties(internalProperties).options.update && !this.getInternalProperties(internalProperties).alreadyCreated) {
            setupFlow.push(() => (0, utilities_1.updateTable)(this));
        }
        // Run setup flow
        const setupFlowPromise = setupFlow.reduce((existingFlow, flow) => {
            return existingFlow.then(() => flow()).then((flow) => {
                return typeof flow === "function" ? flow() : flow;
            });
        }, Promise.resolve());
        setupFlowPromise.then(() => this.getInternalProperties(internalProperties).ready = true).then(() => {
            this.getInternalProperties(internalProperties).pendingTasks.forEach((task) => task());
            this.getInternalProperties(internalProperties).pendingTasks = [];
        });
        // this.transaction = [
        // 	// `function` Default: `this[key]`
        // 	// `settingsIndex` Default: 1
        // 	// `dynamoKey` Default: utils.capitalize_first_letter(key)
        // 	{"key": "get"},
        // 	{"key": "create", "dynamoKey": "Put"},
        // 	{"key": "delete"},
        // 	{"key": "update", "settingsIndex": 2, "modifier": (response: DynamoDB.UpdateItemInput): DynamoDB.UpdateItemInput => {
        // 		delete response.ReturnValues;
        // 		return response;
        // 	}},
        // 	{"key": "condition", "settingsIndex": -1, "dynamoKey": "ConditionCheck", "function": async (key: string, condition: Condition): Promise<DynamoDB.ConditionCheck> => ({
        // 		"Key": this.getInternalProperties(internalProperties).models[0].Item.objectToDynamo(this.getInternalProperties(internalProperties).convertObjectToKey(key)),
        // 		"TableName": this.getInternalProperties(internalProperties).name,
        // 		...condition ? await condition.requestObject(this) : {}
        // 	} as any)}
        // ].reduce((accumulator: ObjectType, currentValue) => {
        // 	const {key, modifier} = currentValue;
        // 	const dynamoKey = currentValue.dynamoKey || utils.capitalize_first_letter(key);
        // 	const settingsIndex = currentValue.settingsIndex || 1;
        // 	const func = currentValue.function || this[key].bind(this);
        // 	accumulator[key] = async (...args): Promise<DynamoDB.TransactWriteItem> => {
        // 		if (typeof args[args.length - 1] === "function") {
        // 			console.warn("Dynamoose Warning: Passing callback function into transaction method not allowed. Removing callback function from list of arguments.");
        // 			args.pop();
        // 		}
        // 		if (settingsIndex >= 0) {
        // 			args[settingsIndex] = utils.merge_objects({"return": "request"}, args[settingsIndex] || {});
        // 		}
        // 		let result = await func(...args);
        // 		if (modifier) {
        // 			result = modifier(result);
        // 		}
        // 		return {[dynamoKey]: result};
        // 	};
        // 	return accumulator;
        // }, {});
    }
    get hashKey() {
        return this.getInternalProperties(internalProperties).getHashKey();
    }
    get rangeKey() {
        return this.getInternalProperties(internalProperties).getRangeKey();
    }
    create(settings, callback) {
        var _a;
        if (typeof settings === "function") {
            callback = settings;
        }
        const promise = ((_a = settings) === null || _a === void 0 ? void 0 : _a.return) === "request" ? (0, utilities_1.createTableRequest)(this) : (0, utilities_1.createTable)(this, true);
        if (callback) {
            promise.then((response) => callback(null, response)).catch((error) => callback(error));
        }
        else {
            return promise;
        }
    }
}
exports.Table = Table;
Table.defaults = defaults_1.original;
var TableUpdateOptions;
(function (TableUpdateOptions) {
    TableUpdateOptions["ttl"] = "ttl";
    TableUpdateOptions["indexes"] = "indexes";
    TableUpdateOptions["throughput"] = "throughput";
    TableUpdateOptions["tags"] = "tags";
    TableUpdateOptions["tableClass"] = "tableClass";
})(TableUpdateOptions = exports.TableUpdateOptions || (exports.TableUpdateOptions = {}));
