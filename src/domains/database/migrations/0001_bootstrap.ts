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
      .createTable("saveGame")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("boardWidth", "integer", (col) => col.notNull())
      .addColumn("boardHeight", "integer", (col) => col.notNull())
      .addColumn("inventorySlots", "integer", (col) => col.notNull())
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    await db.schema
      .createTable("boardItem")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("saveGameId", "text", (col) => col.notNull().references("saveGame.id").onDelete("cascade"))
      .addColumn("itemDefinitionId", "text", (col) => col.notNull())
      .addColumn("x", "integer", (col) => col.notNull())
      .addColumn("y", "integer", (col) => col.notNull())
      .addColumn("stateJson", "text", (col) => col.notNull())
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addUniqueConstraint("boardItem_saveGameId_x_y", ["saveGameId", "x", "y"])
      .execute();

    await db.schema
      .createTable("inventoryStack")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("saveGameId", "text", (col) => col.notNull().references("saveGame.id").onDelete("cascade"))
      .addColumn("slotIndex", "integer", (col) => col.notNull())
      .addColumn("itemDefinitionId", "text", (col) => col.notNull())
      .addColumn("quantity", "integer", (col) => col.notNull())
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addUniqueConstraint("inventoryStack_saveGameId_slotIndex", ["saveGameId", "slotIndex"])
      .execute();

    await db.schema.createIndex("boardItem_saveGameId").on("boardItem").column("saveGameId").execute();
    await db.schema.createIndex("inventoryStack_saveGameId").on("inventoryStack").column("saveGameId").execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable("inventoryStack").ifExists().execute();
    await db.schema.dropTable("boardItem").ifExists().execute();
    await db.schema.dropTable("saveGame").ifExists().execute();
    await db.schema.dropTable("metadata").ifExists().execute();
  },
};
