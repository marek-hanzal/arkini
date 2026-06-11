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
      .addColumn("sort", "integer", (col) => col.notNull())
      .addColumn("isEnabled", "integer", (col) => col.notNull().defaultTo(1))
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    await db.schema
      .createTable("itemDefinition")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("assetId", "text", (col) => col.notNull().references("assetDefinition.id").onDelete("restrict"))
      .addColumn("code", "text", (col) => col.notNull().unique())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("tier", "integer", (col) => col.notNull())
      .addColumn("maxStackSize", "integer", (col) => col.notNull())
      .addColumn("description", "text", (col) => col.notNull())
      .addColumn("tagsJson", "text", (col) => col.notNull())
      .addColumn("sort", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("isEnabled", "integer", (col) => col.notNull().defaultTo(1))
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    await db.schema
      .createTable("mergeDefinition")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("inputItemId", "text", (col) => col.notNull().references("itemDefinition.id").onDelete("restrict"))
      .addColumn("inputCount", "integer", (col) => col.notNull().defaultTo(2))
      .addColumn("outputItemId", "text", (col) => col.notNull().references("itemDefinition.id").onDelete("restrict"))
      .addColumn("isEnabled", "integer", (col) => col.notNull().defaultTo(1))
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addUniqueConstraint("mergeDefinition_inputItemId_inputCount", ["inputItemId", "inputCount"])
      .execute();

    await db.schema
      .createTable("dropTableDefinition")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("label", "text", (col) => col.notNull())
      .addColumn("isEnabled", "integer", (col) => col.notNull().defaultTo(1))
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    await db.schema
      .createTable("dropTableEntry")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("dropTableId", "text", (col) => col.notNull().references("dropTableDefinition.id").onDelete("cascade"))
      .addColumn("itemDefinitionId", "text", (col) => col.references("itemDefinition.id").onDelete("restrict"))
      .addColumn("weight", "integer", (col) => col.notNull())
      .addColumn("quantityJson", "text")
      .addColumn("sort", "integer", (col) => col.notNull())
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    await db.schema
      .createTable("producerDefinition")
      .addColumn("itemDefinitionId", "text", (col) => col.primaryKey().references("itemDefinition.id").onDelete("restrict"))
      .addColumn("cooldownMs", "integer", (col) => col.notNull())
      .addColumn("modeJson", "text", (col) => col.notNull())
      .addColumn("spawnJson", "text", (col) => col.notNull())
      .addColumn("rollsJson", "text", (col) => col.notNull())
      .addColumn("isEnabled", "integer", (col) => col.notNull().defaultTo(1))
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    await db.schema
      .createTable("buildRecipeDefinition")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("blueprintItemId", "text", (col) => col.notNull().references("itemDefinition.id").onDelete("restrict"))
      .addColumn("resultItemId", "text", (col) => col.notNull().references("itemDefinition.id").onDelete("restrict"))
      .addColumn("costsJson", "text", (col) => col.notNull())
      .addColumn("isEnabled", "integer", (col) => col.notNull().defaultTo(1))
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
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
      .addColumn("itemDefinitionId", "text", (col) => col.notNull().references("itemDefinition.id").onDelete("restrict"))
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
      .addColumn("itemDefinitionId", "text", (col) => col.notNull().references("itemDefinition.id").onDelete("restrict"))
      .addColumn("quantity", "integer", (col) => col.notNull())
      .addColumn("createdAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addUniqueConstraint("inventoryStack_saveGameId_slotIndex", ["saveGameId", "slotIndex"])
      .execute();

    await db.schema.createIndex("itemDefinition_assetId").on("itemDefinition").column("assetId").execute();
    await db.schema.createIndex("mergeDefinition_outputItemId").on("mergeDefinition").column("outputItemId").execute();
    await db.schema.createIndex("dropTableEntry_dropTableId").on("dropTableEntry").column("dropTableId").execute();
    await db.schema.createIndex("buildRecipeDefinition_blueprintItemId").on("buildRecipeDefinition").column("blueprintItemId").execute();
    await db.schema.createIndex("boardItem_saveGameId").on("boardItem").column("saveGameId").execute();
    await db.schema.createIndex("inventoryStack_saveGameId").on("inventoryStack").column("saveGameId").execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable("inventoryStack").ifExists().execute();
    await db.schema.dropTable("boardItem").ifExists().execute();
    await db.schema.dropTable("saveGame").ifExists().execute();
    await db.schema.dropTable("buildRecipeDefinition").ifExists().execute();
    await db.schema.dropTable("producerDefinition").ifExists().execute();
    await db.schema.dropTable("dropTableEntry").ifExists().execute();
    await db.schema.dropTable("dropTableDefinition").ifExists().execute();
    await db.schema.dropTable("mergeDefinition").ifExists().execute();
    await db.schema.dropTable("itemDefinition").ifExists().execute();
    await db.schema.dropTable("assetDefinition").ifExists().execute();
    await db.schema.dropTable("metadata").ifExists().execute();
  },
};
