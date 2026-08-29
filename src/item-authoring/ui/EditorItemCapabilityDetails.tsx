import { BatteryCharging, Combine, type LucideIcon } from "lucide-react";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import { useEditorProject } from "~/ui/editor/useEditorProject";
import { PrimaryButtonLink } from "~/ui/button/Button";
import {
	DetailFact,
	DetailFacts,
	DetailSection,
} from "~/item-authoring/ui/EditorItemDetailDefinition";
import { OutputDetail } from "~/item-authoring/ui/EditorItemOutputDetail";
import { EditorSelectorDetail } from "~/item-authoring/ui/EditorSelectorDetail";
import type { EditorItemOptionalCapability } from "~/item-authoring/ui/EditorItemSections";
import { Status } from "~/ui/status/Status";

const DisabledCapabilityDetail = ({
	actionLabel,
	capability,
	description,
	icon,
	itemUid,
	title,
}: {
	readonly actionLabel: string;
	readonly capability: EditorItemOptionalCapability;
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
export const EditorItemChargesDetail = ({ item }: { readonly item: ItemSchema.Type }) =>
	item.charges === undefined ? (
		<DisabledCapabilityDetail
			actionLabel="Enable charges"
			capability="charges"
			description="Charges give this item a finite number of uses. Spending the last charge depletes it and may emit a configured output."
			icon={BatteryCharging}
			itemUid={item.uid}
			title="Charges are disabled"
		/>
	) : (
		<DetailSection title="Charges">
			<div className="grid gap-5">
				<DetailFact
					label="Initial charges"
					value={item.charges.amount}
				/>
				<div>
					<h3 className="text-sm font-semibold">Depletion output</h3>
					<div className="mt-2 border-t border-line pt-3">
						<OutputDetail output={item.charges.output} />
					</div>
				</div>
			</div>
		</DetailSection>
	);

const MergeDetail = ({
	index,
	merge,
}: {
	readonly index: number;
	readonly merge: MergeSchema.Type;
}) => (
	<article className="grid gap-4 border-b border-line pb-6 last:border-0 last:pb-0">
		<h3 className="text-base font-semibold">Merge {index + 1}</h3>
		<DetailFacts>
			<DetailFact
				label="Target"
				value={<EditorSelectorDetail selector={merge.target} />}
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
					mono
					value={merge.result}
				/>
			) : null}
		</DetailFacts>
		<div>
			<h4 className="text-sm font-semibold">Extra output</h4>
			<div className="mt-2 border-t border-line pt-3">
				<OutputDetail output={merge.output} />
			</div>
		</div>
	</article>
);

/** Presents authored merge interactions or their explicit disabled state. */
export const EditorItemMergesDetail = ({ item }: { readonly item: ItemSchema.Type }) =>
	item.merge === undefined || item.merge.length === 0 ? (
		<DisabledCapabilityDetail
			actionLabel="Enable merges"
			capability="merges"
			description="Merges define what happens when this item is dropped onto a matching target, including source consumption, target changes and optional output."
			icon={Combine}
			itemUid={item.uid}
			title="Merges are disabled"
		/>
	) : (
		<DetailSection title="Merges">
			<div className="grid gap-6">
				{item.merge.map((merge, index) => (
					<MergeDetail
						key={`${merge.effect}-${index}`}
						index={index}
						merge={merge}
					/>
				))}
			</div>
		</DetailSection>
	);
