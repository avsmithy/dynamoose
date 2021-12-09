declare const _default: {
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
    COMBINE: (attributes: string[], separator?: string | undefined) => {
        value: string;
        settings: {
            attributes: string[];
            separator?: string | undefined;
        };
    };
};
export = _default;
