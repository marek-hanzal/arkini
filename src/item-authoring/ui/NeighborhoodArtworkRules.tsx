import { useMemo } from "react";
import { readCanonicalItemArtworkFn } from "~/item-authoring/schema/FormSchema";
import { useStore } from "@tanstack/react-form";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";

import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { NeighborhoodArtworkBoard } from "~/item-authoring/ui/NeighborhoodArtworkBoard";
import { useNeighborhoodArtworkRulesController } from "~/item-authoring/ui/useNeighborhoodArtworkRulesController";
import { LinkButton } from "~/ui/ui/LinkButton";
import { ItemSpotlight } from "~/ui/ui/ItemSpotlight";

/** Authors ordered local artwork overrides without creating runtime item instances. */
export const NeighborhoodArtworkRules = () => {
	const { form, validationIssues } = useFormSession();
	const values = useStore(form.store, (state) => state.values);
	const asset = values.asset;
	const owner = useMemo(
		() => ({
			id: values.id,
			uid: values.uid,
			title: values.title,
			type: values.type,
			asset: readCanonicalItemArtworkFn(asset),
		}),
		[
			values.id,
			values.uid,
			values.title,
			values.type,
			asset,
		],
	);
	const rules = asset.neighbors ?? [];
	const invalidRuleIndex = validationIssues.find(
		(issue) =>
			issue.path[0] === "asset" &&
			issue.path[1] === "neighbors" &&
			typeof issue.path[2] === "number",
	)?.path[2] as number | undefined;
	const controller = useNeighborhoodArtworkRulesController({
		owner,
		invalidRuleIndex,
		rules,
		onChangeFn: (next) => form.setFieldValue("asset.neighbors", next),
	});
	return (
		<EditorFormCard>
			<section
				className="grid gap-4"
				data-ui="NeighborhoodArtworkRules"
			>
				<header className="grid gap-1">
					<h2 className="text-base font-semibold">Neighborhood artwork</h2>
					<p className="text-sm text-muted">
						The first matching rule replaces the complete artwork. Only neighbors in the
						same board layer count.
					</p>
				</header>
				<div className="flex min-w-0 items-end gap-2">
					<div className="min-w-0 flex-1">
						<EditorSearchCombobox
							label="Rules"
							emptyLabel="No neighborhood rules match this search."
							renderPreviewFn={() => null}
							displaySelectedLabel
							options={rules.map((rule, index) => ({
								id: String(index),
								label: `${index + 1}. ${rule.sourceId || "New rule"}`,
								terms: [
									rule.sourceId,
									String(index + 1),
								],
							}))}
							value={
								controller.activeRule === undefined
									? ""
									: String(controller.activeIndex)
							}
							onChangeFn={(value) => controller.selectRuleFn(Number(value))}
						/>
					</div>
					<LinkButton
						className="inline-flex h-[var(--ak-control-min-height)] w-8 shrink-0 items-center justify-center"
						title="Add neighborhood rule"
						onClick={controller.addFn}
					>
						<Plus className="size-4" />
					</LinkButton>
				</div>
				{controller.activeRule === undefined ? (
					<p className="text-sm text-muted">
						No neighborhood rules. The item uses its default or progress artwork.
					</p>
				) : (
					<>
						<div className="flex flex-wrap gap-2">
							<LinkButton
								className="inline-flex size-8 items-center justify-center"
								title="Clone neighborhood rule"
								onClick={controller.cloneFn}
							>
								<Copy className="size-4" />
							</LinkButton>
							<LinkButton
								className="inline-flex size-8 items-center justify-center"
								title="Move neighborhood rule up"
								disabled={controller.activeIndex === 0}
								onClick={() => controller.moveFn(-1)}
							>
								<ArrowUp className="size-4" />
							</LinkButton>
							<LinkButton
								className="inline-flex size-8 items-center justify-center"
								title="Move neighborhood rule down"
								disabled={controller.activeIndex === rules.length - 1}
								onClick={() => controller.moveFn(1)}
							>
								<ArrowDown className="size-4" />
							</LinkButton>
							<LinkButton
								className="inline-flex size-8 items-center justify-center"
								title="Remove neighborhood rule"
								onClick={controller.removeFn}
							>
								<Trash2 className="size-4" />
							</LinkButton>
						</div>
						<div className="flex flex-wrap items-start gap-4">
							<NeighborhoodArtworkBoard
								rule={controller.activeRule}
								scale={asset.scale}
								items={controller.items}
								onCycleFn={controller.cycleFn}
								onChooseItemFn={controller.chooseItemFn}
							/>
							<div className="grid min-w-48 flex-1 gap-3">
								<form.AppField
									name={`asset.neighbors[${controller.activeIndex}].sourceId`}
								>
									{(field) => <field.AssetField label="Result asset" />}
								</form.AppField>
								<p className="text-sm text-muted">
									Click a neighbor to cycle: Any → Empty → Filled → choose an item
									→ Any. Use the pencil to change a selected item.
								</p>
								<p className="text-sm text-muted">
									Every specified cell must match. Any accepts anything; Empty
									requires an unoccupied cell. The center shows this rule’s
									result.
								</p>
							</div>
						</div>
					</>
				)}
				{controller.pickerOpen ? (
					<ItemSpotlight
						dataUi="NeighborhoodArtworkItemSpotlight"
						emptyMessage="No items match this search."
						placement="viewport"
						options={controller.options}
						onCloseFn={controller.closePickerFn}
						onSelectItemFn={controller.selectItemFn}
						placeholder="Search neighbor item…"
					/>
				) : null}
			</section>
		</EditorFormCard>
	);
};
