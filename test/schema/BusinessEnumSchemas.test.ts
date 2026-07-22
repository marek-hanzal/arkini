import { describe, expect, it } from "vitest";

import { DistanceEnumSchema } from "~/engine/distance/schema/DistanceEnumSchema";
import { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import { InputModeEnumSchema } from "~/engine/input/schema/InputModeEnumSchema";
import { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { RuleEnumSchema as LineRuleEnumSchema } from "~/engine/line/schema/rule/RuleEnumSchema";
import { ActionEnumSchema } from "~/engine/merge/schema/ActionEnumSchema";
import { EffectEnumSchema } from "~/engine/merge/schema/EffectEnumSchema";
import { RuleEnumSchema as OutputRuleEnumSchema } from "~/engine/output/schema/drop/rule/RuleEnumSchema";
import { PlacementEnumSchema } from "~/engine/placement/schema/PlacementEnumSchema";
import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";
import { QuantityEnumSchema } from "~/engine/quantity/schema/QuantityEnumSchema";
import { QueryScopeEnumSchema } from "~/engine/query/schema/QueryScopeEnumSchema";
import { RollEnumSchema } from "~/engine/roll/schema/RollEnumSchema";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";
import { SelectorEnumSchema } from "~/engine/selector/schema/SelectorEnumSchema";
import { WhenEnumSchema } from "~/engine/when/schema/WhenEnumSchema";

describe("business enum schemas", () => {
	it("exposes stable named members for core engine vocabularies", () => {
		expect(DistanceEnumSchema.options).toEqual([
			DistanceEnumSchema.enum.Close,
			DistanceEnumSchema.enum.Near,
			DistanceEnumSchema.enum.Far,
		]);
		expect(InputEnumSchema.options).toEqual([
			InputEnumSchema.enum.Simple,
			InputEnumSchema.enum.Materials,
			InputEnumSchema.enum.Deposit,
		]);
		expect(InputModeEnumSchema.options).toEqual([
			InputModeEnumSchema.enum.Consume,
			InputModeEnumSchema.enum.Reserve,
		]);
		expect(InputChargeFromEnumSchema.options).toEqual([
			InputChargeFromEnumSchema.enum.Self,
			InputChargeFromEnumSchema.enum.Target,
		]);
		expect(ItemEnumSchema.options).toEqual([
			ItemEnumSchema.enum.Deposit,
			ItemEnumSchema.enum.Blueprint,
			ItemEnumSchema.enum.Simple,
			ItemEnumSchema.enum.Producer,
			ItemEnumSchema.enum.Craft,
			ItemEnumSchema.enum.Stash,
			ItemEnumSchema.enum.Temporary,
			ItemEnumSchema.enum.Inventory,
		]);
		expect(ItemDetailTabEnumSchema.options).toEqual([
			ItemDetailTabEnumSchema.enum.Info,
			ItemDetailTabEnumSchema.enum.Lines,
			ItemDetailTabEnumSchema.enum.Queue,
			ItemDetailTabEnumSchema.enum.Sources,
		]);
		expect(LineRuleEnumSchema.options).toEqual([
			LineRuleEnumSchema.enum.Show,
			LineRuleEnumSchema.enum.Hide,
			LineRuleEnumSchema.enum.Enable,
			LineRuleEnumSchema.enum.Disable,
			LineRuleEnumSchema.enum.RuntimeMultiplier,
		]);
		expect(ActionEnumSchema.options).toEqual([
			ActionEnumSchema.enum.Use,
			ActionEnumSchema.enum.Consume,
		]);
		expect(EffectEnumSchema.options).toEqual([
			EffectEnumSchema.enum.Keep,
			EffectEnumSchema.enum.Remove,
			EffectEnumSchema.enum.Replace,
		]);
		expect(OutputRuleEnumSchema.options).toEqual([
			OutputRuleEnumSchema.enum.Enable,
			OutputRuleEnumSchema.enum.Disable,
		]);
		expect(PlacementEnumSchema.options).toEqual([
			PlacementEnumSchema.enum.Drop,
			PlacementEnumSchema.enum.Random,
		]);
		expect(PlacementFailureReasonEnumSchema.options).toEqual([
			PlacementFailureReasonEnumSchema.enum.ItemMaxCount,
			PlacementFailureReasonEnumSchema.enum.BoardFull,
			PlacementFailureReasonEnumSchema.enum.InventoryFull,
			PlacementFailureReasonEnumSchema.enum.ToolbarFull,
		]);
		expect(QuantityEnumSchema.options).toEqual([
			QuantityEnumSchema.enum.Value,
			QuantityEnumSchema.enum.Range,
		]);
		expect(RollEnumSchema.options).toEqual([
			RollEnumSchema.enum.Guaranteed,
			RollEnumSchema.enum.Chance,
			RollEnumSchema.enum.Weight,
		]);
		expect(StorageScopeEnumSchema.options).toEqual([
			StorageScopeEnumSchema.enum.Board,
			StorageScopeEnumSchema.enum.Inventory,
			StorageScopeEnumSchema.enum.Toolbar,
			StorageScopeEnumSchema.enum.Any,
		]);
		expect(QueryScopeEnumSchema.options).toEqual([
			QueryScopeEnumSchema.enum.Board,
			QueryScopeEnumSchema.enum.Inventory,
			QueryScopeEnumSchema.enum.Toolbar,
			QueryScopeEnumSchema.enum.Any,
			QueryScopeEnumSchema.enum.Universe,
		]);
		expect(SelectorEnumSchema.options).toEqual([
			SelectorEnumSchema.enum.Item,
			SelectorEnumSchema.enum.Tag,
		]);
		expect(WhenEnumSchema.options).toEqual([
			WhenEnumSchema.enum.Exists,
			WhenEnumSchema.enum.Count,
			WhenEnumSchema.enum.Range,
		]);
	});
});
