import { Condition, ConditionInitalizer, BasicOperators } from "./Condition";
import { Model } from "./Model";
import { Item } from "./Item";
import { CallbackType, ObjectType, ItemArray, SortOrder } from "./General";
import { InternalPropertiesClass } from "./InternalPropertiesClass";
declare enum ItemRetrieverTypes {
    scan = "scan",
    query = "query"
}
interface ItemRetrieverTypeInformation {
    type: ItemRetrieverTypes;
    pastTense: string;
}
interface ItemRetrieverInternalProperties {
    internalSettings: {
        model: Model<Item>;
        typeInformation: ItemRetrieverTypeInformation;
    };
    settings: {
        condition: Condition;
        sort?: SortOrder | `${SortOrder}`;
        parallel?: number;
        all?: {
            delay?: number;
            max?: number;
        };
        attributes?: string[];
        count?: number;
        consistent?: boolean;
        index?: string;
        startAt?: ObjectType;
        limit?: number;
    };
}
declare abstract class ItemRetriever extends InternalPropertiesClass<ItemRetrieverInternalProperties> {
    getRequest: (this: ItemRetriever) => Promise<any>;
    all: (this: ItemRetriever, delay?: number, max?: number) => ItemRetriever;
    limit: (this: ItemRetriever, value: number) => ItemRetriever;
    startAt: (this: ItemRetriever, value: ObjectType) => ItemRetriever;
    attributes: (this: ItemRetriever, value: string[]) => ItemRetriever;
    count: (this: ItemRetriever) => ItemRetriever;
    consistent: (this: ItemRetriever) => ItemRetriever;
    using: (this: ItemRetriever, value: string) => ItemRetriever;
    exec(this: ItemRetriever, callback?: any): any;
    constructor(model: Model<Item>, typeInformation: ItemRetrieverTypeInformation, object?: ConditionInitalizer);
}
interface ItemRetrieverResponse<T> extends ItemArray<T> {
    lastKey?: ObjectType;
    count: number;
}
export interface ScanResponse<T> extends ItemRetrieverResponse<T> {
    scannedCount: number;
    timesScanned: number;
}
export interface QueryResponse<T> extends ItemRetrieverResponse<T> {
    queriedCount: number;
    timesQueried: number;
}
export interface Scan<T> extends ItemRetriever, BasicOperators<Scan<T>> {
    exec(): Promise<ScanResponse<T>>;
    exec(callback: CallbackType<ScanResponse<T>, any>): void;
}
export declare class Scan<T> extends ItemRetriever {
    parallel(value: number): Scan<T>;
    constructor(model: Model<Item>, object?: ConditionInitalizer);
}
export interface Query<T> extends ItemRetriever, BasicOperators<Query<T>> {
    exec(): Promise<QueryResponse<T>>;
    exec(callback: CallbackType<QueryResponse<T>, any>): void;
}
export declare class Query<T> extends ItemRetriever {
    sort(order: SortOrder | `${SortOrder}`): Query<T>;
    constructor(model: Model<Item>, object?: ConditionInitalizer);
}
export {};
