import type {
  EffectiveDropEffectOutcome,
  EffectiveLine,
  EffectiveLootPlan,
} from "~/effects/EffectiveLine";
import { readEffectiveLootPlanOutputSets } from "~/effects/readEffectiveOutputEntries";

type LineOutputEntry = EffectiveLine["lootPlan"]["visibleOutput"][number];
type WeightedOutputEntry = Extract<LineOutputEntry, { type: "weighted" }>;

export interface EffectiveLootPlanViewEntry {
  enabled?: boolean;
  effects?: readonly EffectiveDropEffectOutcome[];
  itemId: string;
  kind: "chance" | "guaranteed" | "weighted";
  outputSetIndex: number;
  outputSetWeight: number;
  probability?: number;
  quantity?:
    | number
    | {
        max: number;
        min: number;
      };
  rolls?: WeightedOutputEntry["rolls"];
  sort?: number;
  sourceIndex: number;
  totalOutputSetWeight: number;
}

const maxUnsortedOutputSort = Number.MAX_SAFE_INTEGER;

const readOutputQuantity = (
  quantity: EffectiveLootPlanViewEntry["quantity"] | undefined,
): EffectiveLootPlanViewEntry["quantity"] => quantity ?? 1;

const readOutputEntrySort = (
  output: {
    sort?: number;
  },
  entrySort?: number,
) => entrySort ?? output.sort;

const readOutputProbability = ({
  enabled,
  entry,
}: {
  enabled?: boolean;
  entry: Extract<LineOutputEntry, { type: "chance" | "guaranteed" }>;
}) => {
  if (enabled === false) return 0;
  if (entry.type === "chance") return entry.chance;
  return undefined;
};

const readWeightedOutputTotalWeight = (
  entries: WeightedOutputEntry["entries"],
) =>
  entries
    .filter((entry) => entry.enabled)
    .reduce((total, entry) => total + entry.weight, 0);

const readWeightedOutputProbability = ({
  entry,
  totalWeight,
}: {
  entry: WeightedOutputEntry["entries"][number];
  totalWeight: number;
}) => {
  if (entry.enabled === false || totalWeight <= 0) return 0;
  return entry.weight / totalWeight;
};

const compareOutputViews = (
  left: EffectiveLootPlanViewEntry,
  right: EffectiveLootPlanViewEntry,
) =>
  (left.sort ?? maxUnsortedOutputSort) -
    (right.sort ?? maxUnsortedOutputSort) ||
  left.itemId.localeCompare(right.itemId) ||
  left.kind.localeCompare(right.kind) ||
  left.sourceIndex - right.sourceIndex;

const collectOutputViewEntries = ({
  output,
  outputSetIndex,
  outputSetWeight,
  sourceIndexOffset,
  totalOutputSetWeight,
}: {
  output: EffectiveLootPlan["visibleOutput"];
  outputSetIndex: number;
  outputSetWeight: number;
  sourceIndexOffset: number;
  totalOutputSetWeight: number;
}): EffectiveLootPlanViewEntry[] =>
  output.flatMap((entry, outputIndex): EffectiveLootPlanViewEntry[] => {
    const sourceIndex = sourceIndexOffset + outputIndex;

    if (entry.type === "weighted") {
      const totalWeight = readWeightedOutputTotalWeight(entry.entries);
      return entry.entries.map((weightedEntry, weightedEntryIndex) => ({
        enabled: weightedEntry.enabled,
        effects: weightedEntry.dropEffects,
        itemId: weightedEntry.itemId,
        kind: "weighted",
        outputSetIndex,
        outputSetWeight,
        probability: readWeightedOutputProbability({
          entry: weightedEntry,
          totalWeight,
        }),
        quantity: readOutputQuantity(weightedEntry.quantity),
        rolls: entry.rolls ?? 1,
        sort: readOutputEntrySort(entry, weightedEntry.sort),
        sourceIndex: sourceIndex * 1000 + weightedEntryIndex,
        totalOutputSetWeight,
      }));
    }

    return [
      {
        enabled: entry.enabled,
        effects: entry.dropEffects,
        itemId: entry.itemId,
        kind: entry.type,
        outputSetIndex,
        outputSetWeight,
        probability: readOutputProbability({
          enabled: entry.enabled,
          entry,
        }),
        quantity: readOutputQuantity(entry.quantity),
        sort: entry.sort,
        sourceIndex,
        totalOutputSetWeight,
      },
    ];
  });

const readOutputSetViewEntries = ({
  outputSet,
  outputSetIndex,
  sourceIndexOffset,
  totalOutputSetWeight,
}: {
  outputSet: ReturnType<typeof readEffectiveLootPlanOutputSets>[number];
  outputSetIndex: number;
  sourceIndexOffset: number;
  totalOutputSetWeight: number;
}) => {
  const outputs: EffectiveLootPlanViewEntry[] = [];

  outputs.push(
    ...collectOutputViewEntries({
      output: outputSet.visibleOutput,
      outputSetIndex,
      outputSetWeight: outputSet.weight,
      sourceIndexOffset,
      totalOutputSetWeight,
    }),
  );

  const chanceSourceIndexOffset =
    sourceIndexOffset + outputSet.visibleOutput.length * 1000 + 1000;
  for (const [chanceIndex, chanceItem] of outputSet.chanceItems.entries()) {
    outputs.push({
      enabled: true,
      effects: chanceItem.dropEffects,
      itemId: chanceItem.itemId,
      kind: "chance",
      outputSetIndex,
      outputSetWeight: outputSet.weight,
      probability: chanceItem.chance,
      quantity: chanceItem.quantity ?? 1,
      sourceIndex: chanceSourceIndexOffset + chanceIndex,
      totalOutputSetWeight,
    });
  }

  return outputs.map((output) => ({
    ...output,
    sourceIndex: output.sourceIndex + outputSetIndex * 1_000_000,
  }));
};

export const readEffectiveLootPlanViewEntries = (
  lootPlan: EffectiveLootPlan,
): EffectiveLootPlanViewEntry[] => {
  let sourceIndexOffset = 0;
  const outputSets = readEffectiveLootPlanOutputSets(lootPlan);
  const totalOutputSetWeight = outputSets.reduce(
    (total, outputSet) => total + outputSet.weight,
    0,
  );
  const outputs: EffectiveLootPlanViewEntry[] = [];

  for (const [outputSetIndex, outputSet] of outputSets.entries()) {
    outputs.push(
      ...readOutputSetViewEntries({
        outputSet,
        outputSetIndex,
        sourceIndexOffset,
        totalOutputSetWeight,
      }),
    );
    sourceIndexOffset +=
      outputSet.visibleOutput.length * 1000 +
      outputSet.chanceItems.length +
      1000;
  }

  return outputs.sort(compareOutputViews);
};
