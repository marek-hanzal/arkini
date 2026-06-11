import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const migration0001Bootstrap: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable("metadata")
      .addColumn("key", "text", (col) => col.primaryKey())
      .addColumn("value", "text", (col) => col.notNull())
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    await db.schema
      .createTable("assetDefinition")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("kind", "text", (col) => col.notNull())
      .addColumn("label", "text", (col) => col.notNull())
      .addColumn("src", "text", (col) => col.notNull())
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    await db.schema
      .createTable("itemDefinition")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("assetId", "text", (col) => col.notNull().references("assetDefinition.id").onDelete("restrict"))
      .addColumn("code", "text", (col) => col.notNull().unique())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("tier", "integer", (col) => col.notNull())
      .addColumn("description", "text")
      .addColumn("sort", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    await db.schema
      .createTable("mergeRecipe")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("inputItemId", "text", (col) => col.notNull().references("itemDefinition.id").onDelete("cascade"))
      .addColumn("outputItemId", "text", (col) => col.notNull().references("itemDefinition.id").onDelete("cascade"))
      .addColumn("inputCount", "integer", (col) => col.notNull().defaultTo(2))
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addUniqueConstraint("mergeRecipe_inputItemId_inputCount", ["inputItemId", "inputCount"])
      .execute();

    await db.schema
      .createTable("saveGame")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("boardWidth", "integer", (col) => col.notNull())
      .addColumn("boardHeight", "integer", (col) => col.notNull())
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    await db.schema
      .createTable("boardSlot")
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("saveGameId", "text", (col) => col.notNull().references("saveGame.id").onDelete("cascade"))
      .addColumn("x", "integer", (col) => col.notNull())
      .addColumn("y", "integer", (col) => col.notNull())
      .addColumn("itemDefinitionId", "text", (col) => col.references("itemDefinition.id").onDelete("set null"))
      .addColumn("stack", "integer", (col) => col.notNull().defaultTo(1))
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addUniqueConstraint("boardSlot_saveGameId_x_y", ["saveGameId", "x", "y"])
      .execute();

    await db.schema.createIndex("itemDefinition_assetId").on("itemDefinition").column("assetId").execute();
    await db.schema.createIndex("mergeRecipe_outputItemId").on("mergeRecipe").column("outputItemId").execute();
    await db.schema.createIndex("boardSlot_saveGameId").on("boardSlot").column("saveGameId").execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable("boardSlot").ifExists().execute();
    await db.schema.dropTable("saveGame").ifExists().execute();
    await db.schema.dropTable("mergeRecipe").ifExists().execute();
    await db.schema.dropTable("itemDefinition").ifExists().execute();
    await db.schema.dropTable("assetDefinition").ifExists().execute();
    await db.schema.dropTable("metadata").ifExists().execute();
  },
};
