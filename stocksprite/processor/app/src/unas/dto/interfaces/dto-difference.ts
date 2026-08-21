export interface IDtoDifference {
    op: string;
    path: (string | number)[];
    value?: unknown;
}
