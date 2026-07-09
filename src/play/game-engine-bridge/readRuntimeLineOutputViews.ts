import type { LineView } from "~/board/view/LineViewSchema";
import { readGameSaveItemQuantityByScope } from "~/activation/readGameSaveItemQuantityByScope";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { EffectiveLine } from "~/effects/EffectiveLine";
import type { EffectiveLineBonusSummary } from "~/effects/readEffectiveLineBonusEntries";
import {
  readEffectiveLootPlanViewEntries,
  type EffectiveLootPlanViewEntry,
} from "~/effects/readEffectiveLootPlanViewEntries";

type EffectiveLootPlan = EffectiveLine["lootPlan"];
type LineOutputView = NonNullable<LineView["outputs"]>[number];
type LineOutputQuantity = NonNullable<LineOutputView["quantity"]>;

export namespace readRuntimeLineOutputViews {
  export interface Props {
    effectBonusSummary?: EffectiveLineBonusSummary;
    lootPlan: EffectiveLootPlan;
    save: GameSave;
  }
}

const readOutputQuantity = (
  quantity: LineOutputQuantity | undefined,
): LineOutputQuantity => quantity ?? 1;

const readOwnedQuantity = ({
  itemId,
  save,
}: {
  itemId: string;
  save: GameSave;
}) =>
  readGameSaveItemQuantityByScope({
    itemId,
    save,
    scope: "board_or_inventory",
  });

const readDropEffects = (
  effects: EffectiveLootPlanViewEntry["effects"] | undefined,
) =>
  effects?.length
    ? effects.map((effect) => ({
        active: effect.active,
        impact: effect.impact,
        kind: effect.kind,
        label: effect.label,
        ready: effect.ready,
        result: effect.result,
      }))
    : undefined;

const readOutputBonusLines = ({
  effectBonusSummary,
  itemId,
}: {
  effectBonusSummary?: EffectiveLineBonusSummary;
  itemId: string;
}) => {
  if (!effectBonusSummary) return undefined;
  const lines = [
    ...effectBonusSummary.universalLines,
    ...(effectBonusSummary.byItemId.get(itemId) ?? []),
  ];
  return lines.length > 0 ? lines : undefined;
};

const readRollLabel = (rolls: LineOutputQuantity) => {
  if (typeof rolls !== "number")
    return `weighted · ${rolls.min}-${rolls.max} rolls`;
  return rolls > 1 ? `weighted · ${rolls} rolls` : "weighted roll";
};

const formatRollSetPercent = (value: number) => {
  const percent = value * 100;
  if (percent >= 10) return `${Math.round(percent)}%`;
  return `${Number(percent.toFixed(1))}%`;
};

const readRollSetLabel = ({
  outputSetIndex,
  outputSetWeight,
  totalOutputSetWeight,
}: Pick<
  EffectiveLootPlanViewEntry,
  "outputSetIndex" | "outputSetWeight" | "totalOutputSetWeight"
>) =>
  `Set ${outputSetIndex + 1} · ${formatRollSetPercent(outputSetWeight / totalOutputSetWeight)}`;

const isZeroChanceEffectCarrier = (entry: EffectiveLootPlanViewEntry) =>
  entry.kind === "chance" &&
  entry.enabled !== false &&
  entry.probability === 0 &&
  (entry.effects ?? []).some((effect) => effect.impact === "chance");

const createOutputView = ({
  effectBonusSummary,
  entry,
  hasMultipleOutputSets,
  save,
}: {
  effectBonusSummary?: EffectiveLineBonusSummary;
  entry: EffectiveLootPlanViewEntry;
  hasMultipleOutputSets: boolean;
  save: GameSave;
}): LineOutputView => ({
  bonusLines: readOutputBonusLines({
    effectBonusSummary,
    itemId: entry.itemId,
  }),
  enabled: entry.enabled,
  effects: readDropEffects(entry.effects),
  itemId: entry.itemId,
  kind: entry.kind,
  ownedQuantity: readOwnedQuantity({
    itemId: entry.itemId,
    save,
  }),
  probability: entry.probability,
  quantity: readOutputQuantity(entry.quantity),
  rollLabel: entry.kind === "weighted" ? readRollLabel(entry.rolls ?? 1) : undefined,
  rollSetLabel: hasMultipleOutputSets
    ? readRollSetLabel({
        outputSetIndex: entry.outputSetIndex,
        outputSetWeight: entry.outputSetWeight,
        totalOutputSetWeight: entry.totalOutputSetWeight,
      })
    : undefined,
  sort: entry.sort,
});

export const readRuntimeLineOutputViews = ({
  effectBonusSummary,
  lootPlan,
  save,
}: readRuntimeLineOutputViews.Props): LineOutputView[] => {
  const viewEntries = readEffectiveLootPlanViewEntries(lootPlan);
  const hasMultipleOutputSets =
    new Set(viewEntries.map((entry) => entry.outputSetIndex)).size > 1;

  return viewEntries
    .filter((entry) => !isZeroChanceEffectCarrier(entry))
    .map((entry) =>
      createOutputView({
        effectBonusSummary,
        entry,
        hasMultipleOutputSets,
        save,
      }),
    );
};
