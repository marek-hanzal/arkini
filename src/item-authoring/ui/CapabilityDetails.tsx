import { Tx } from "~/translation/ui/Tx";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { useTranslator } from "~/translation/ui/useTranslator";
import { ArrowUpRight, BatteryCharging, Combine } from "lucide-react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { ButtonLink } from "~/ui/ui/Button";
import { DetailFact, DetailFacts } from "~/item-authoring/ui/DetailDefinition";
import { OutputDetail } from "~/item-authoring/ui/OutputDetail";
import { SelectorDetail } from "~/item-authoring/ui/SelectorDetail";
import { DetailReference } from "~/item-authoring/ui/DetailReference";

/** Presents the optional unit capability or its explicit disabled state. */
export const UnitsDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	return item.units === undefined ? (
		<EditorRootCard dataUi="EditorItemUnitsDisabledCard">
			<DisabledCapabilityDetail
				actionLabel={translator.textFn("Enable units")}
				capability="units"
				icon={BatteryCharging}
				itemUid={item.uid}
				title={translator.textFn("Item units empty title")}
			/>
		</EditorRootCard>
	) : (
		<div className="grid gap-3">
			<EditorRootCard dataUi="EditorItemUnitsCard">
				<DetailFact
					label={translator.textFn("Initial units")}
					description={translator.textFn(
						"Finite units inside one item, separate from stack quantity. Spending the final unit depletes the item.",
					)}
					value={item.units.amount}
				/>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorItemDepletionOutputCard">
				<OutputDetail
					emptyLabel={translator.textFn("No depletion output configured.")}
					output={item.units.output}
					description={translator.textFn(
						"Output resolved when the final unit is spent. Without output, the depleted item disappears after its accepted production settles.",
					)}
					title={translator.textFn("Depletion output")}
				/>
			</EditorRootCard>
		</div>
	);
};

const MergeDetail = ({
	index,
	itemUid,
	merge,
}: {
	readonly index: number;
	readonly itemUid: string;
	readonly merge: MergeSchema.Type;
}) => {
	const translator = useTranslator();
	const project = useEditorProject();
	return (
		<EditorRootCard dataUi="EditorItemMergeDetailCard">
			<h3 className="text-base font-semibold">
				<ButtonLink
					to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
					params={{
						projectId: project.projectId,
						itemUid,
						sectionId: "merges",
					}}
					search={{
						merge: index,
					}}
					className="group inline-flex min-h-0 w-fit max-w-full flex-none items-center justify-start gap-1.5 rounded-none border-0 bg-transparent p-0 text-left text-[inherit] font-[inherit] decoration-accent/55 underline-offset-4 shadow-none hover:border-transparent hover:bg-transparent hover:text-accent hover:underline active:bg-transparent"
					data-ui="EditorItemMergeDetailEditLink"
				>
					<Tx label="Merge" /> {index + 1}
					<ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
				</ButtonLink>
			</h3>
			<DetailFacts>
				<DetailFact
					label={translator.textFn("Target")}
					description={translator.textFn(
						"The receiving item must match this selector for the merge to apply.",
					)}
					value={<SelectorDetail selector={merge.target} />}
				/>
				<DetailFact
					label={translator.textFn("Source action")}
					description={translator.textFn(
						"Use returns one source item after the merge, Consume removes one source item, and Spend removes one of its units.",
					)}
					value={translator.textFn(
						merge.action === "spend"
							? "Spend"
							: merge.action === "use"
								? "Use"
								: "Consume",
					)}
				/>
				<DetailFact
					label={translator.textFn("Target effect")}
					description={translator.textFn(
						"Keep leaves the receiving item unchanged, Remove takes one item from its stack, Spend removes one unit, and Replace swaps one item for the configured result.",
					)}
					value={translator.textFn(
						merge.effect === "spend"
							? "Spend"
							: merge.effect === "keep"
								? "Keep"
								: merge.effect === "remove"
									? "Remove"
									: "Replace",
					)}
				/>
				{"result" in merge ? (
					<DetailFact
						label={translator.textFn("Replacement item")}
						value={<DetailReference itemId={merge.result} />}
					/>
				) : null}
			</DetailFacts>
			<OutputDetail
				emptyLabel={translator.textFn("No extra output configured.")}
				output={merge.output}
				title={translator.textFn("Extra output")}
				description={translator.textFn(
					"Optional output resolved after the source action and target effect complete.",
				)}
			/>
		</EditorRootCard>
	);
};

/** Presents authored merge interactions or their explicit disabled state. */
export const MergesDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			{item.merge === undefined || item.merge.length === 0 ? (
				<EditorRootCard dataUi="EditorItemMergesDisabledCard">
					<DisabledCapabilityDetail
						actionLabel={translator.textFn("Enable merges")}
						capability="merges"
						icon={Combine}
						itemUid={item.uid}
						title={translator.textFn("Item merges empty title")}
					/>
				</EditorRootCard>
			) : (
				<div className="grid gap-3">
					{item.merge.map((merge, index) => (
						<MergeDetail
							key={`${merge.effect}-${index}`}
							index={index}
							itemUid={item.uid}
							merge={merge}
						/>
					))}
				</div>
			)}
		</div>
	);
};
