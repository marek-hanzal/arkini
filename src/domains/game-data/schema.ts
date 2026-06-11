import { z } from "zod";

const positiveInteger = z.number().int().positive();
const nonNegativeInteger = z.number().int().nonnegative();
const itemId = z.string().startsWith("item:");
const assetId = z.string().startsWith("asset:");
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
      merge: z.array(
        z.object({
          id: z.string().startsWith("merge:"),
          withItemId: itemId,
          resultItemId: itemId,
          inputCount: z.literal(2).optional(),
          secret: z.boolean().optional(),
        }),
      ).optional(),
      producer: z.object({
        trigger: z.enum(["click", "auto"]),
        placement: z.literal("board_then_inventory"),
        cooldownMs: positiveInteger.optional(),
        drops: z.array(
          z.union([
            z.object({ itemId, weight: positiveInteger, quantity: quantitySchema.optional() }),
            z.object({ itemId: z.null(), weight: positiveInteger }),
          ]),
        ).min(1),
        doubleClickBehavior: z.enum(["exhaust"]).optional(),
        mode: z.discriminatedUnion("type", [
          z.object({ type: z.literal("infinite") }),
          z.object({
            type: z.literal("finite"),
            charges: positiveInteger,
            onDepleted: z.union([z.literal("remove"), z.object({ replaceWithItemId: itemId })]),
          }),
          z.object({
            type: z.literal("auto"),
            tickMs: positiveInteger,
            capacity: positiveInteger,
            rechargeMs: positiveInteger,
            enabledByDefault: z.boolean(),
          }),
        ]).optional(),
      }).optional(),
      build: z.object({
        id: z.string().startsWith("build:"),
        resultItemId: itemId,
        costs: z.array(z.object({ itemId, quantity: positiveInteger })),
      }).optional(),
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
