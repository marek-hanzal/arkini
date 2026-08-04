import type { ReactNode } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type {
	EditorDrop,
	EditorInput,
	EditorItem,
	EditorLine,
	EditorOutput,
	EditorQuantity,
	EditorSelector,
} from "~/bridge/item/editor/EditorItemModel";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { ButtonLink } from "~/ui/button/Button";
import { ItemLineOutputs } from "~/ui/item-detail/ItemLineOutputs";
import { formatItemDuration } from "~/ui/item-detail/ItemRuntime";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";

type EditorItemRegistry = Record<string, EditorItem>;

const readQuantityBounds = (quantity: EditorQuantity) => quantity;

const formatQuantity = (quantity: EditorQuantity) => {
	const bounds = readQuantityBounds(quantity);
	return bounds.min === bounds.max ? String(bounds.min) : bounds.min + "–" + bounds.max;
};

const formatChargeCost = (input: EditorInput) => {
	if (input.charges === undefined) return "";
	return (
		" · " +
		input.charges.cost +
		" charge" +
		(input.charges.cost === 1 ? "" : "s") +
		" from " +
		(input.charges.from === "self" ? "owner" : "target")
	);
};

const readSelectorLabel = (selector: EditorSelector, items: EditorItemRegistry) =>
	items[selector.itemId]?.title ?? selector.itemId;

const EditorItemDetailReference = ({
	item,
	projectId,
}: {
	readonly item: EditorItem;
	readonly projectId: string;
}) => (
	<ButtonLink
		to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
		params={{
			itemUid: item.uid,
			projectId,
			sectionId: "identity",
		}}
		className="group min-h-0 min-w-0 justify-start gap-3 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent"
	>
		<EditorItemThumbnail
			className="rounded-lg border-0 bg-surface/45 ring-1 ring-line/50"
			imageClassName="p-0.5"
			resourceIds={item.asset.default}
			size="sm"
		/>
		<span className="truncate font-medium text-foreground">{item.title}</span>
	</ButtonLink>
);

const projectDrop = (drop: EditorDrop, items: EditorItemRegistry): ItemDetailLines.OutputItem => {
	const item = items[drop.itemId];
	return {
		itemId: drop.itemId,
		quantity: readQuantityBounds(drop.quantity),
		title: item?.title ?? drop.itemId,
	};
};

const projectOutput = (
	output: EditorOutput | undefined,
	items: EditorItemRegistry,
): readonly ItemDetailLines.OutputSet[] =>
	output?.set.map((set) => ({
		roll: set.roll.map((roll): ItemDetailLines.OutputRoll => {
			if (roll.type === "weight") {
				return {
					kind: "weight",
					option: roll.drop.map((option) => ({
						item: option.drop.map((drop) => projectDrop(drop, items)),
						weight: option.weight,
					})),
					selections: readQuantityBounds(roll.quantity),
				};
			}
			return roll.type === "guaranteed"
				? {
						item: roll.drop.map((drop) => projectDrop(drop, items)),
						kind: "guaranteed",
					}
				: {
						chance: roll.chance,
						item: roll.drop.map((drop) => projectDrop(drop, items)),
						kind: "chance",
					};
		}),
		weight: set.weight ?? 1,
	})) ?? [];

const EditorLineInputReference = ({
	items,
	projectId,
	selector,
}: {
	readonly items: EditorItemRegistry;
	readonly projectId: string;
	readonly selector: EditorSelector;
}) => {
	const item = items[selector.itemId];
	return item === undefined ? (
		<p className="truncate font-medium text-foreground">{readSelectorLabel(selector, items)}</p>
	) : (
		<EditorItemDetailReference
			item={item}
			projectId={projectId}
		/>
	);
};

const EditorLineInput = ({
	input,
	items,
	projectId,
}: {
	readonly input: EditorInput;
	readonly items: EditorItemRegistry;
	readonly projectId: string;
}) => {
	const rowClassName =
		"ak-line-input grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 rounded-xl bg-transparent px-3 py-2 text-sm";
	if (input.type === "simple") {
		return input.charges === undefined ? null : (
			<div className={rowClassName}>
				<p className="font-medium text-foreground">Owner charge</p>
				<p className="text-right text-sm text-muted">
					{input.charges.cost} charge{input.charges.cost === 1 ? "" : "s"} from{" "}
					{input.charges.from === "self" ? "owner" : "target"}
				</p>
			</div>
		);
	}
	const selector = input.type === "materials" ? input.selector : input.query.selector;
	return (
		<div className={rowClassName}>
			<div className="min-w-0">
				<EditorLineInputReference
					items={items}
					projectId={projectId}
					selector={selector}
				/>
				<p className="mt-0.5 text-xs text-muted">
					{input.type === "materials"
						? input.mode === "consume"
							? "Consumed"
							: "Reserved"
						: "Board · " + input.query.distance}
					{formatChargeCost(input)}
				</p>
			</div>
			<p className="text-right font-medium text-foreground">
				{input.type === "materials"
					? "×" + formatQuantity(input.quantity) + " required"
					: "Required"}
			</p>
		</div>
	);
};

const EditorLineInputs = ({
	input,
	items,
	projectId,
}: {
	readonly input: readonly EditorInput[];
	readonly items: EditorItemRegistry;
	readonly projectId: string;
}) => {
	const visibleInput = input.filter(
		(entry) => entry.type !== "simple" || entry.charges !== undefined,
	);
	return (
		<section className="min-w-0">
			<h4 className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
				Inputs
			</h4>
			{visibleInput.length === 0 ? (
				<p className="py-3 text-sm text-muted">No material input required.</p>
			) : (
				<div className="space-y-1 pt-2">
					{visibleInput.map((entry, index) => (
						<EditorLineInput
							input={entry}
							items={items}
							key={entry.type + ":" + index}
							projectId={projectId}
						/>
					))}
				</div>
			)}
		</section>
	);
};

const EditorLineRuntime = ({ runtimeMs }: { readonly runtimeMs: number }) => (
	<div className="grid min-w-32 grid-rows-[1rem_1.5rem_1rem] text-right">
		<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Runtime</p>
		<div className="col-start-1 row-span-2 row-start-2 grid grid-rows-[1.5rem_1rem]">
			<p className="self-center font-semibold tabular-nums text-foreground">
				{formatItemDuration(runtimeMs)}
			</p>
			<p className="self-end text-xs tabular-nums text-muted">Per cycle</p>
		</div>
	</div>
);

const renderOutputItem = (
	item: ItemDetailLines.OutputItem,
	items: EditorItemRegistry,
	projectId: string,
): ReactNode => {
	const definition = items[item.itemId];
	return definition === undefined ? (
		<span className="truncate font-medium text-foreground">{item.title}</span>
	) : (
		<EditorItemDetailReference
			item={definition}
			projectId={projectId}
		/>
	);
};

/** Mirrors the game's product-line overview without runtime commands, state, progress, or motion. */
export const EditorProductionLineDetail = ({ line }: { readonly line: EditorLine }) => {
	const project = useEditorProject();
	const items = project.config?.items ?? {};
	return (
		<article
			className="ak-list-row overflow-hidden rounded-xl border-b border-l-2 border-line border-l-line/55 px-3 py-5 pl-4 first:pt-3 last:border-b-0 last:pb-5"
			data-ui="EditorProductionLineDetail"
			data-line-id={line.id}
		>
			<div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-lg font-semibold leading-tight text-foreground">
							{line.title}
						</h3>
						{!line.enable ? (
							<span className="rounded-full border border-danger/35 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-foreground">
								Disabled
							</span>
						) : null}
						{line.default ? (
							<span className="rounded-full border border-accent/35 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-foreground">
								Default
							</span>
						) : null}
					</div>
					<p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
						{line.description}
					</p>
				</div>
				<EditorLineRuntime runtimeMs={line.runtimeMs} />
			</div>
			<div className="relative z-[1] mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] gap-x-4">
				<EditorLineInputs
					input={line.input}
					items={items}
					projectId={project.projectId}
				/>
				<div
					className="grid place-items-center text-muted"
					data-ui="EditorProductionLineFlowChevron"
				>
					<span className="icon-[lucide--chevron-right] size-5" />
				</div>
				<ItemLineOutputs
					disabled={false}
					output={projectOutput(line.output, items)}
					renderItem={(item) => renderOutputItem(item, items, project.projectId)}
				/>
			</div>
		</article>
	);
};
