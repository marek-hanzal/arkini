import { Migrator } from "kysely/migration";
import { kysely } from "./client";

export const migrator = new Migrator({
  db: kysely,
  provider: {
    async getMigrations() {
      const { migrations } = await import("./migrations");
      return migrations;
    },
  },
});
