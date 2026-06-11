import { z } from "zod";

const positiveInteger = z.number().int().positive();
const nonNegativeInteger = z.number().int().nonnegative();
const itemId = z.string().startsWith("item:");
const assetId = z.string().startsWith("asset:");
const dropTableId = z.string().startsWith("drop:");

const quantitySchema = z.union([
  positiveInteger,
  z.object({ min: positiveInteger, max: positiveInteger }).refine((value) => value.max >= value.min, {
    message: "max must be >= min",
  }),
]);

export const gameDataManifestSchema = z.object({
  game: z.object({
    id: z.literal("arkini"),
    title: z.string().min(1),
    dataVersion: positiveInteger,
    board: z.object({ width: z.literal(7), height: z.literal(9) }),
    inventory: z.object({ slots: positiveInteger }),
  }),
  assets: z.array(
    z.object({
      id: assetId,
      kind: z.enum(["item", "ui"]),
      label: z.string().min(1),
      src: z.string().min(1),
      sort: nonNegativeInteger,
    }),
  ),
  items: z.array(
    z.object({
      id: itemId,
      assetId,
      code: z.string().min(1),
      name: z.string().min(1),
      tier: positiveInteger,
      maxStackSize: positiveInteger,
      description: z.string(),
      tags: z.array(z.string().min(1)),
      sort: nonNegativeInteger,
    }),
  ),
  merges: z.array(
    z.object({
      id: z.string().startsWith("merge:"),
      inputItemId: itemId,
      inputCount: z.number().int().min(2),
      outputItemId: itemId,
    }),
  ),
  dropTables: z.array(
    z.object({
      id: dropTableId,
      label: z.string().min(1),
      entries: z.array(
        z.union([
          z.object({ itemId, weight: positiveInteger, quantity: quantitySchema }),
          z.object({ itemId: z.null(), weight: positiveInteger }),
        ]),
      ).min(1),
    }),
  ),
  producers: z.array(
    z.object({
      itemId,
      cooldownMs: positiveInteger,
      mode: z.discriminatedUnion("type", [
        z.object({ type: z.literal("infinite") }),
        z.object({
          type: z.literal("finite"),
          charges: positiveInteger,
          onDepleted: z.union([
            z.literal("remove"),
            z.object({ replaceWithItemId: itemId }),
          ]),
        }),
      ]),
      spawn: z.object({
        type: z.literal("around_self"),
        radius: z.literal(1),
        placement: z.literal("all_or_nothing"),
      }),
      rolls: z.array(z.object({ dropTableId, count: quantitySchema })).min(1),
    }),
  ),
  buildRecipes: z.array(
    z.object({
      id: z.string().startsWith("build:"),
      blueprintItemId: itemId,
      resultItemId: itemId,
      costs: z.array(z.object({ itemId, quantity: positiveInteger })),
    }),
  ),
  startingState: z.object({
    inventory: z.array(z.object({ itemId, quantity: positiveInteger })),
    board: z.array(z.object({ itemId, x: nonNegativeInteger, y: nonNegativeInteger })),
  }),
});

export function parseGameDataManifest(manifest: unknown) {
  return gameDataManifestSchema.parse(manifest);
}
