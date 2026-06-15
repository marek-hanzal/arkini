import type { ColumnType } from "kysely";

export type Timestamp = ColumnType<string, string | undefined, string>;
