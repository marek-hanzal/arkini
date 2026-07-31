import type { InputSchema } from "~/engine/input/schema/InputSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RuleSchema as LineRuleSchema } from "~/engine/line/schema/rule/RuleSchema";
import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { RuleSchema as DropRuleSchema } from "~/engine/output/schema/drop/rule/RuleSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import type { QuerySchema } from "~/engine/query/schema/QuerySchema";
import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";
import type { DropWeightSchema } from "~/engine/roll/schema/DropWeightSchema";
import type { RollSchema } from "~/engine/roll/schema/RollSchema";
import type { RollSetSchema } from "~/engine/roll/schema/RollSetSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

export type EditorItem = ItemSchema.Type;
export type EditorItemType = ItemEnumSchema.Type;
export type EditorInput = InputSchema.Type;
export type EditorLine = LineSchema.Type;
export type EditorLineRule = LineRuleSchema.Type;
export type EditorMerge = MergeSchema.Type;
export type EditorDrop = DropSchema.Type;
export type EditorDropRule = DropRuleSchema.Type;
export type EditorOutput = OutputSchema.Type;
export type EditorQuery = QuerySchema.Type;
export type EditorQuantity = QuantitySchema.Type;
export type EditorDropWeight = DropWeightSchema.Type;
export type EditorRoll = RollSchema.Type;
export type EditorRollSet = RollSetSchema.Type;
export type EditorSelector = SelectorSchema.Type;
export type EditorWhen = WhenSchema.Type;

export const EditorItemTypes: ReadonlyArray<EditorItemType> = ItemEnumSchema.options;

export const parseEditorItemType = (candidate: unknown) => ItemEnumSchema.parse(candidate);

export const validateEditorItem = (candidate: unknown) => ItemSchema.safeParse(candidate);
