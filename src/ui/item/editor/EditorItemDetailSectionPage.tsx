import type { EditorItem, EditorLine, EditorMerge } from "~/bridge/item/editor/EditorItemModel";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { PrimaryButtonLink } from "~/ui/button/Button";
import {
	ItemInfoFact,
	ItemInfoFacts,
	ItemStorageScopeLabel,
	ItemTypeLabel,
} from "~/ui/item-detail/ItemInfoPresentation";
import {
	DetailFact,
	DetailFacts,
	DetailSection,
	formatSelector,
	OutputDetail,
} from "~/ui/item/editor/EditorItemDetailDefinition";
import { EditorItemNotFound } from "~/ui/item/editor/EditorItemNotFound";
import {
	readEditorItemSections,
	type EditorItemOptionalCapability,
	type EditorItemSectionId,
} from "~/ui/item/editor/EditorItemSections";
import { EditorItemArtworkTimeline } from "~/ui/item/editor/EditorItemArtworkTimeline";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { EditorProductionLineDetail } from "~/ui/item/editor/EditorProductionLineDetail";
import { useEditorItemByUid } from "~/ui/item/editor/useEditorItemByUid";
import { EditorAssetDetailLink } from "~/ui/resource/editor/EditorAssetDetailLink";
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
	readonly icon: string;
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

const IdentityDetail = ({ item }: { readonly item: EditorItem }) => (
	<div>
		<section className="pb-5">
			<p className="max-w-4xl text-pretty text-base leading-relaxed text-muted">
				{item.description || "No player-facing description."}
			</p>
		</section>
		<section className="border-t border-line pt-2">
			<ItemInfoFacts>
				<ItemInfoFact
					label="Type"
					value={ItemTypeLabel[item.type]}
				/>
				<ItemInfoFact
					label="Storage"
					value={ItemStorageScopeLabel[item.scope]}
				/>
				<ItemInfoFact
					label="Stack capacity"
					value={item.maxStackSize === 1 ? "Single item" : `${item.maxStackSize} items`}
				/>
				<ItemInfoFact
					label="Game limit"
					value={item.maxCount === undefined ? "No configured limit" : item.maxCount}
				/>
				<ItemInfoFact
					label="Item ID"
					mono
					value={item.id}
				/>
				<ItemInfoFact
					label="UID"
					mono
					value={item.uid}
				/>
			</ItemInfoFacts>
		</section>
	</div>
);

const ArtworkDetail = ({ item }: { readonly item: EditorItem }) => (
	<div className="grid gap-6">
		<DetailSection
			description="Default composition is shown in authoritative back-to-front order."
			title="Default artwork"
		>
			<div className="flex items-center gap-5">
				<EditorItemThumbnail resourceIds={item.asset.default} />
				<ol className="grid gap-1 text-sm">
					{item.asset.default.map((resourceId, index) => (
						<li key={resourceId}>
							<EditorAssetDetailLink
								className="font-mono text-sm"
								resourceId={resourceId}
							>
								{index + 1}. {resourceId}
							</EditorAssetDetailLink>
						</li>
					))}
				</ol>
			</div>
		</DetailSection>
		<DetailSection title="Progress artwork">
			<EditorItemArtworkTimeline
				asset={item.asset}
				linkAssets
			/>
		</DetailSection>
	</div>
);

const ChargesDetail = ({ item }: { readonly item: EditorItem }) =>
	item.charges === undefined ? (
		<DisabledCapabilityDetail
			actionLabel="Enable charges"
			capability="charges"
			description="Charges give this item a finite number of uses. Spending the last charge depletes it and may emit a configured output."
			icon="icon-[lucide--battery-charging]"
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

const MergeDetail = ({ index, merge }: { readonly index: number; readonly merge: EditorMerge }) => (
	<article className="grid gap-4 border-b border-line pb-6 last:border-0 last:pb-0">
		<h3 className="text-base font-semibold">Merge {index + 1}</h3>
		<DetailFacts>
			<DetailFact
				label="Target"
				value={formatSelector(merge.target)}
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

const MergesDetail = ({ item }: { readonly item: EditorItem }) =>
	item.merge === undefined || item.merge.length === 0 ? (
		<DisabledCapabilityDetail
			actionLabel="Enable merges"
			capability="merges"
			description="Merges define what happens when this item is dropped onto a matching target, including source consumption, target changes and optional output."
			icon="icon-[lucide--combine]"
			itemUid={item.uid}
			title="Merges are disabled"
		/>
	) : (
		<DetailSection title="Merges">
			<div className="grid gap-6">
				{item.merge.map((merge, index) => (
					<MergeDetail
						index={index}
						key={`${merge.effect}-${index}`}
						merge={merge}
					/>
				))}
			</div>
		</DetailSection>
	);

const readProductionLines = (item: EditorItem): ReadonlyArray<EditorLine> => {
	switch (item.type) {
		case "blueprint":
		case "craft":
		case "stash":
			return [
				item.line,
			];
		case "deposit":
		case "producer":
			return item.lines ?? [];
		default:
			return [];
	}
};

const ProductionDetail = ({ item }: { readonly item: EditorItem }) => {
	const lines = readProductionLines(item);
	if (lines.length > 0) {
		return (
			<div className="ak-list grid gap-3">
				{lines.map((line) => (
					<EditorProductionLineDetail
						key={line.id}
						line={line}
					/>
				))}
			</div>
		);
	}
	return (
		<div className="grid gap-6">
			{"durationMs" in item ? (
				<>
					<DetailSection title="Lifetime">
						<DetailFact
							label="Duration"
							value={`${item.durationMs} ms`}
						/>
					</DetailSection>
					<DetailSection title="Expiry output">
						<OutputDetail output={item.output} />
					</DetailSection>
				</>
			) : null}
		</div>
	);
};

/** Renders one canonical item section without introducing editable state. */
export const EditorItemDetailSectionPage = ({
	sectionId,
	uid,
}: {
	readonly sectionId: EditorItemSectionId;
	readonly uid: string;
}) => {
	const item = useEditorItemByUid(uid);
	if (item === undefined) return <EditorItemNotFound uid={uid} />;
	const available = readEditorItemSections(item).some((candidate) => candidate.id === sectionId);
	if (!available) {
		return (
			<section
				className="grid gap-2 py-8 text-center"
				data-ui="EditorItemSectionUnavailable"
			>
				<h2 className="text-lg font-semibold">Section unavailable</h2>
				<p className="text-sm text-muted">
					This item type does not use the {sectionId} section.
				</p>
			</section>
		);
	}
	switch (sectionId) {
		case "identity":
			return <IdentityDetail item={item} />;
		case "artwork":
			return <ArtworkDetail item={item} />;
		case "charges":
			return <ChargesDetail item={item} />;
		case "merges":
			return <MergesDetail item={item} />;
		case "production":
			return <ProductionDetail item={item} />;
	}
};
