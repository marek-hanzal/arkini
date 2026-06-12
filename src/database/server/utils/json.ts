export const parseJson = <T>(value: string): T => JSON.parse(value) as T;
export const json = (value: unknown) => JSON.stringify(value);
