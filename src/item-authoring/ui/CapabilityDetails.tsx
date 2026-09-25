import { readSpaceDestinationLabelFn } from "~/space/fn/readSpaceDestinationLabelFn";
import { match } from "ts-pattern";
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
import { OutcomeDetail } from "~/item-authoring/ui/OutcomeDetail";
import { SelectorDetail } from "~/item-authoring/ui/SelectorDetail";
import { DetailReference } from "~/item-authoring/ui/DetailReference";
import { Mx } from "~/translation/ui/Mx";
import { TemplateDetailReference } from "~/template-authoring/ui/TemplateDetailReference";

/** Presents the optional unit capability or its explicit disabled state. */
export const UnitsDetail = ({
	item,
	preview = false,
}: {
	readonly item: ItemSchema.Type;
	readonly preview?: boolean;
}) => {
	const translator = useTranslator();
	if (item.units === undefined) {
		const empty = (
			<DisabledCapabilityDetail
				actionLabel={translator.textFn("Enable")}
				capability="units"
				icon={BatteryCharging}
				itemUid={item.uid}
				title={translator.textFn(
					preview ? "Item units empty title" : "No Units configured",
				)}
				summary={preview ? undefined : translator.textFn("Item units empty title")}
				size={preview ? "normal" : "large"}
			/>
		);
		return preview ? (
			<EditorRootCard dataUi="EditorItemUnitsDisabledCard">{empty}</EditorRootCard>
		) : (
			empty
		);
	}
	return (
		<div className="grid gap-3">
			<EditorRootCard dataUi="EditorItemUnitsCard">
				<DetailFact
					label={translator.textFn("Initial units")}
					description={<Mx label="Authored Units amount summary help" />}
					value={item.units.amount}
				/>
			</EditorRootCard>
		</div>
	);
};

export const MergeDetail = ({
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
					description={<Mx label="Authored merge target summary help" />}
					value={
						merge.action === "space" ? (
							typeof merge.space === "object" ? (
								<TemplateDetailReference templateUid={merge.space.templateUid}>
									{readSpaceDestinationLabelFn(
										merge.space,
										translator.textFn,
										project.config.templates,
									)}
								</TemplateDetailReference>
							) : (
								readSpaceDestinationLabelFn(
									merge.space,
									translator.textFn,
									project.config.templates,
								)
							)
						) : (
							<SelectorDetail selector={merge.target} />
						)
					}
				/>
				<DetailFact
					label={translator.textFn("Source action")}
					description={<Mx label="Authored merge source action summary help" />}
					value={match(merge.action)
						.with("space", () => translator.textFn("Space"))
						.with("spend", () => translator.textFn("Spend"))
						.with("use", () => translator.textFn("Use"))
						.with("consume", () => translator.textFn("Consume"))
						.exhaustive()}
				/>
				{"result" in merge ? (
					<DetailFact
						label={translator.textFn("Replacement item")}
						value={<DetailReference itemUid={merge.result} />}
					/>
				) : null}
				<DetailFact
					label={translator.textFn("Target effect")}
					description={<Mx label="Authored merge target effect summary help" />}
					value={match(merge.effect)
						.with("spend", () => translator.textFn("Spend"))
						.with("keep", () => translator.textFn("Keep"))
						.with("remove", () => translator.textFn("Remove"))
						.with("replace", () => translator.textFn("Replace"))
						.exhaustive()}
				/>
			</DetailFacts>
			<OutcomeDetail
				emptyLabel={translator.textFn("No extra outcome configured.")}
				outcome={merge.outcome}
				title={translator.textFn("Extra outcome")}
				description={<Mx label="Authored merge outcome summary help" />}
			/>
		</EditorRootCard>
	);
};

/** Shows the first authored merge interaction with access to the complete read-only collection. */
export const MergesDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	return (
		<div className="grid">
			{item.merge === undefined || item.merge.length === 0 ? (
				<EditorRootCard dataUi="EditorItemMergesDisabledCard">
					<DisabledCapabilityDetail
						actionLabel={translator.textFn("Enable")}
						capability="merges"
						icon={Combine}
						itemUid={item.uid}
						title={translator.textFn("Item merges empty title")}
					/>
				</EditorRootCard>
			) : (
				<div className="grid content-start gap-3">
					{item.merge.slice(0, 1).map((merge, index) => (
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
