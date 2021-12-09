import { TableOptions, TableOptionsOptional } from "./index";
export declare const original: TableOptions;
declare const customObject: {
    set: (val: TableOptionsOptional) => void;
    get: () => TableOptionsOptional;
};
export { customObject as custom };
