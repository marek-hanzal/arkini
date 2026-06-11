import type { Migration } from "kysely/migration";
import { migration0001Bootstrap } from "./0001_bootstrap";

export const migrations = {
  "0001_bootstrap": migration0001Bootstrap,
} satisfies Record<string, Migration>;
