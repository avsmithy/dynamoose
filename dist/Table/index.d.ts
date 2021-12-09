import { CallbackType, DeepPartial, ObjectType } from "../General";
import { Model } from "../Model";
import DynamoDB = require("@aws-sdk/client-dynamodb");
import { IndexItem } from "../Schema";
import { Item as ItemCarrier } from "../Item";
import { TableClass } from "./types";
import { InternalPropertiesClass } from "../InternalPropertiesClass";
interface TableInternalProperties {
    options: TableOptions;
    name: string;
    originalName: string;
    ready: boolean;
    alreadyCreated: boolean;
    pendingTasks: any[];
    pendingTaskPromise: () => Promise<void>;
    models: any[];
    latestTableDetails?: DynamoDB.DescribeTableOutput;
    getIndexes: () => Promise<{
        GlobalSecondaryIndexes?: IndexItem[];
        LocalSecondaryIndexes?: IndexItem[];
        TableIndex?: any;
    }>;
    modelForObject: (object: ObjectType) => Promise<Model<ItemCarrier>>;
    getCreateTableAttributeParams: () => Promise<Pick<DynamoDB.CreateTableInput, "AttributeDefinitions" | "KeySchema" | "GlobalSecondaryIndexes" | "LocalSecondaryIndexes">>;
    getHashKey: () => string;
    getRangeKey: () => string;
}
export declare class Table extends InternalPropertiesClass<TableInternalProperties> {
    static defaults: TableOptions;
    name: string;
    constructor(name: string, models: Model[], options?: TableOptionsOptional);
    get hashKey(): string;
    get rangeKey(): string | undefined;
    create(): Promise<void>;
    create(callback: CallbackType<void, any>): void;
    create(settings: TableCreateOptions): Promise<void>;
    create(settings: TableCreateOptions, callback: CallbackType<void, any>): void;
    create(settings: TableCreateOptions & {
        return: "request";
    }): Promise<DynamoDB.CreateTableInput>;
    create(settings: TableCreateOptions & {
        return: "request";
    }, callback: CallbackType<DynamoDB.CreateTableInput, any>): void;
}
interface TableCreateOptions {
    return: "request" | undefined;
}
export interface TableWaitForActiveSettings {
    enabled: boolean;
    check: {
        timeout: number;
        frequency: number;
    };
}
export interface TableExpiresSettings {
    ttl: number;
    attribute: string;
    items?: {
        returnExpired: boolean;
    };
}
export declare enum TableUpdateOptions {
    ttl = "ttl",
    indexes = "indexes",
    throughput = "throughput",
    tags = "tags",
    tableClass = "tableClass"
}
export interface TableOptions {
    create: boolean;
    throughput: "ON_DEMAND" | number | {
        read: number;
        write: number;
    };
    prefix: string;
    suffix: string;
    waitForActive: boolean | TableWaitForActiveSettings;
    update: boolean | TableUpdateOptions[];
    populate: string | string[] | boolean;
    expires: number | TableExpiresSettings;
    tags: {
        [key: string]: string;
    };
    tableClass: TableClass;
}
export declare type TableOptionsOptional = DeepPartial<TableOptions>;
export {};
