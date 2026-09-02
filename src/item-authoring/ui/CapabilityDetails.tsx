import { ArrowUpRight, BatteryCharging, Combine, type LucideIcon } from "lucide-react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { ButtonLink, PrimaryButtonLink } from "~/ui/ui/Button";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { OutputDetail } from "~/item-authoring/ui/OutputDetail";
import { SelectorDetail } from "~/item-authoring/ui/SelectorDetail";
import { DetailReference } from "~/item-authoring/ui/DetailReference";
import type { OptionalCapability } from "~/item-authoring/type/Section";
import { Status } from "~/ui/ui/Status";

const DisabledCapabilityDetail = ({
	actionLabel,
	capability,
	description,
	icon,
	itemUid,
	title,
}: {
	readonly actionLabel: string;
	readonly capability: OptionalCapability;
	readonly description: string;
	readonly icon: LucideIcon;
	readonly itemUid: string;
	readonly title: string;
}) => {
	const project = useEditorProject();
	return (
		<Status
			action={
				<PrimaryButtonLink
					to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
					params={{
						projectId: project.projectId,
						itemUid,
						sectionId: capability,
					}}
					search={{
						enable: capability,
					}}
				>
					{actionLabel}
				</PrimaryButtonLink>
			}
			description={description}
			icon={icon}
			title={title}
			variant="flat"
		/>
	);
};

/** Presents the optional charge capability or its explicit disabled state. */
export const ChargesDetail = ({ item }: { readonly item: ItemSchema.Type }) =>
	item.charges === undefined ? (
		<EditorRootCard dataUi="EditorItemChargesDisabledCard">
			<DisabledCapabilityDetail
				actionLabel="Enable charges"
				capability="charges"
				description="Charges give this item a finite number of uses. Spending the last charge depletes it and may emit a configured output."
				icon={BatteryCharging}
				itemUid={item.uid}
				title="Charges are disabled"
			/>
		</EditorRootCard>
	) : (
		<div className="grid gap-3">
			<EditorRootCard dataUi="EditorItemChargesCard">
				<DetailSection title="Charges">
					<DetailFact
						label="Initial charges"
						value={item.charges.amount}
					/>
				</DetailSection>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorItemDepletionOutputCard">
				<OutputDetail
					emptyLabel="No depletion output configured."
					output={item.charges.output}
					title="Depletion output"
				/>
			</EditorRootCard>
		</div>
	);

const MergeDetail = ({
	index,
	itemUid,
	merge,
}: {
	readonly index: number;
	readonly itemUid: string;
	readonly merge: MergeSchema.Type;
}) => {
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
					Merge {index + 1}
					<ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
				</ButtonLink>
			</h3>
			<DetailFacts>
				<DetailFact
					label="Target"
					value={<SelectorDetail selector={merge.target} />}
				/>
				<DetailFact
					label="Source action"
					value={merge.action}
				/>
				<DetailFact
					label="Target effect"
					value={merge.effect}
				/>
				{"result" in merge ? (
					<DetailFact
						label="Replacement item"
						value={<DetailReference itemId={merge.result} />}
					/>
				) : null}
			</DetailFacts>
			<OutputDetail
				emptyLabel="No extra output configured."
				output={merge.output}
				title="Extra output"
			/>
		</EditorRootCard>
	);
};

/** Presents authored merge interactions or their explicit disabled state. */
export const MergesDetail = ({ item }: { readonly item: ItemSchema.Type }) => (
	<div className="grid gap-[var(--ak-viewport-gap)]">
		<EditorFormSectionDivider
			description="Interactions triggered when this item is dropped onto a matching target."
			title="Merges"
		/>
		{item.merge === undefined || item.merge.length === 0 ? (
			<EditorRootCard dataUi="EditorItemMergesDisabledCard">
				<DisabledCapabilityDetail
					actionLabel="Enable merges"
					capability="merges"
					description="Merges define what happens when this item is dropped onto a matching target, including source consumption, target changes and optional output."
					icon={Combine}
					itemUid={item.uid}
					title="Merges are disabled"
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
