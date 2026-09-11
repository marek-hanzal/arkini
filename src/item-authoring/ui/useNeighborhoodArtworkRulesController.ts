import { useCallback, useMemo, useState } from "react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { NeighborhoodArtworkRuleSchema } from "~/item-definition/schema/NeighborhoodArtworkRuleSchema";
import type { useItemSpotlightController } from "~/ui/ui/useItemSpotlightController";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";
import { createElement } from "react";

export namespace useNeighborhoodArtworkRulesController {
	export interface Props {
		readonly invalidRuleIndex?: number;
		readonly owner: Pick<ItemSchema.Type, "id" | "uid" | "title" | "type" | "asset">;
		readonly rules: ReadonlyArray<NeighborhoodArtworkRuleSchema.Type>;
		readonly onChangeFn: (rules: NeighborhoodArtworkRuleSchema.Type[]) => void;
	}
	export interface Output {
		readonly activeIndex: number;
		readonly activeRule: NeighborhoodArtworkRuleSchema.Type | undefined;
		readonly items: Readonly<Record<string, Pick<ItemSchema.Type, "title" | "asset">>>;
		readonly options: ReadonlyArray<useItemSpotlightController.Option>;
		readonly pickerOpen: boolean;
		readonly addFn: () => void;
		readonly cloneFn: () => void;
		readonly moveFn: (offset: -1 | 1) => void;
		readonly removeFn: () => void;
		readonly selectRuleFn: (index: number) => void;
		readonly cycleFn: (position: keyof NeighborhoodArtworkRuleSchema.Type["neighbors"]) => void;
		readonly chooseItemFn: (
			position: keyof NeighborhoodArtworkRuleSchema.Type["neighbors"],
		) => void;
		readonly closePickerFn: () => void;
		readonly selectItemFn: (itemId: string) => void;
	}
}

/** Owns rule order and the temporary neighbor picker; the item form owns all authored data. */
export const useNeighborhoodArtworkRulesController = ({
	owner,
	invalidRuleIndex,
	rules,
	onChangeFn,
}: useNeighborhoodArtworkRulesController.Props): useNeighborhoodArtworkRulesController.Output => {
	const { items: savedItems, options: searchOptions } = useEditorItemSearchOptions();
	const items = useMemo(
		() => ({
			...savedItems,
			[owner.id]: owner,
		}),
		[
			savedItems,
			owner,
		],
	);
	const [selectedIndex, setSelectedIndexFn] = useState(0);
	const [pickerPosition, setPickerPositionFn] =
		useState<keyof NeighborhoodArtworkRuleSchema.Type["neighbors"]>();
	const activeIndex = Math.min(invalidRuleIndex ?? selectedIndex, Math.max(0, rules.length - 1));
	const activeRule = rules[activeIndex];
	const options = useMemo(
		() =>
			[
				...searchOptions.filter((option) => savedItems[option.id]?.uid !== owner.uid),
				{
					id: owner.id,
					label: owner.title || owner.id,
					meta: `${owner.type} · ${owner.id}`,
					terms: [
						owner.id,
						owner.title,
						owner.type,
					],
				},
			].map((option) => ({
				artwork: createElement(EditorItemThumbnail, {
					resourceIds: items[option.id]!.asset.default,
					size: "sm",
				}),
				itemId: option.id,
				label: option.label,
				secondary: option.meta ?? option.id,
				terms: option.terms,
			})),
		[
			items,
			owner,
			savedItems,
			searchOptions,
		],
	);
	const closePickerFn = useCallback(() => setPickerPositionFn(undefined), []);
	const selectRuleFn = (index: number) => {
		setSelectedIndexFn(index);
		closePickerFn();
	};
	const updateConditionFn = (
		position: keyof NeighborhoodArtworkRuleSchema.Type["neighbors"],
		condition: NeighborhoodArtworkRuleSchema.Type["neighbors"][typeof position],
	) => {
		if (activeRule === undefined) return;
		onChangeFn(
			rules.map((rule, index) =>
				index === activeIndex
					? {
							...rule,
							neighbors: {
								...rule.neighbors,
								[position]: condition,
							},
						}
					: rule,
			),
		);
	};
	const cycleFn = (position: keyof NeighborhoodArtworkRuleSchema.Type["neighbors"]) => {
		const condition = activeRule?.neighbors[position];
		if (condition === undefined) return;
		switch (condition.type) {
			case "ignore":
				updateConditionFn(position, {
					type: "empty",
				});
				break;
			case "empty":
				updateConditionFn(position, {
					type: "filled",
				});
				break;
			case "filled":
				setPickerPositionFn(position);
				break;
			case "item":
				updateConditionFn(position, {
					type: "ignore",
				});
				break;
		}
	};
	return {
		activeIndex,
		activeRule,
		items,
		options,
		pickerOpen: pickerPosition !== undefined,
		addFn: () => {
			onChangeFn([
				...rules,
				{
					sourceId: "",
					neighbors: {
						nw: {
							type: "ignore",
						},
						n: {
							type: "ignore",
						},
						ne: {
							type: "ignore",
						},
						w: {
							type: "ignore",
						},
						e: {
							type: "ignore",
						},
						sw: {
							type: "ignore",
						},
						s: {
							type: "ignore",
						},
						se: {
							type: "ignore",
						},
					},
				},
			]);
			selectRuleFn(rules.length);
		},
		cloneFn: () => {
			if (activeRule === undefined) return;
			onChangeFn([
				...rules.slice(0, activeIndex + 1),
				structuredClone(activeRule),
				...rules.slice(activeIndex + 1),
			]);
			selectRuleFn(activeIndex + 1);
		},
		moveFn: (offset) => {
			const targetIndex = activeIndex + offset;
			if (activeRule === undefined || targetIndex < 0 || targetIndex >= rules.length) return;
			const next = [
				...rules,
			];
			next.splice(activeIndex, 1);
			next.splice(targetIndex, 0, activeRule);
			onChangeFn(next);
			selectRuleFn(targetIndex);
		},
		removeFn: () => {
			onChangeFn(rules.filter((_, index) => index !== activeIndex));
			selectRuleFn(Math.max(0, activeIndex - 1));
		},
		selectRuleFn,
		cycleFn,
		chooseItemFn: setPickerPositionFn,
		closePickerFn,
		selectItemFn: (itemId) => {
			if (pickerPosition === undefined || items[itemId] === undefined) return;
			updateConditionFn(pickerPosition, {
				type: "item",
				itemId,
			});
			closePickerFn();
		},
	};
};
