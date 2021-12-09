import { Schema, SchemaDefinition } from "./Schema";
import { Condition } from "./Condition";
import transaction from "./Transaction";
import { Item, AnyItem } from "./Item";
import { ModelType } from "./General";
import { Table } from "./Table";
declare const _default: {
    model: <T extends Item = AnyItem>(name: string, schema?: Schema | SchemaDefinition | (Schema | SchemaDefinition)[]) => ModelType<T>;
    Table: typeof Table;
    Schema: typeof Schema;
    Condition: typeof Condition;
    transaction: typeof transaction;
    aws: {
        ddb: typeof import("./aws/ddb");
        converter: typeof import("./aws/converter");
    };
    logger: () => Promise<any>;
    type: {
        UNDEFINED: symbol;
        THIS: symbol;
        NULL: symbol;
        ANY: symbol;
        CONSTANT: (value: string | number | boolean) => {
            value: string;
            settings: {
                value: string | number | boolean;
            };
        };
        COMBINE: (attributes: string[], separator?: string) => {
            value: string;
            settings: {
                attributes: string[];
                separator?: string;
            };
        };
    };
};
export = _default;
