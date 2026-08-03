import type { EditorItem, EditorLine, EditorMerge } from "~/bridge/item/editor/EditorItemModel";
import {
	ItemInfoFact,
	ItemInfoFacts,
	ItemStorageScopeLabel,
	ItemTraits,
	ItemTypeLabel,
} from "~/ui/item-detail/ItemInfoPresentation";
import {
	DetailFact,
	DetailFacts,
	DetailSection,
	EmptyDetail,
	formatSelector,
	OutputDetail,
} from "~/ui/item/editor/EditorItemDetailDefinition";
import { EditorItemNotFound } from "~/ui/item/editor/EditorItemNotFound";
import {
	readEditorItemSections,
	type EditorItemSectionId,
} from "~/ui/item/editor/EditorItemSections";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { EditorProductionLineDetail } from "~/ui/item/editor/EditorProductionLineDetail";
import { useEditorItemByUid } from "~/ui/item/editor/useEditorItemByUid";

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
		{item.tags.length === 0 ? null : (
			<section className="border-t border-line pt-5">
				<h2 className="text-sm font-semibold">Traits</h2>
				<div className="mt-3">
					<ItemTraits tags={item.tags} />
				</div>
			</section>
		)}
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
						<li
							className="font-mono"
							key={resourceId}
						>
							{index + 1}. {resourceId}
						</li>
					))}
				</ol>
			</div>
		</DetailSection>
		<DetailSection title="Progress artwork">
			{item.asset.sources === undefined ? (
				<EmptyDetail>No progress artwork.</EmptyDetail>
			) : (
				<ol className="grid gap-2 text-sm">
					{item.asset.sources.map((resourceId, index) => (
						<li
							className="font-mono"
							key={`${resourceId}-${index}`}
						>
							{index + 1}. {resourceId}
						</li>
					))}
				</ol>
			)}
		</DetailSection>
	</div>
);

const LimitsDetail = ({ item }: { readonly item: EditorItem }) => (
	<DetailSection title="Limits">
		<DetailFacts>
			<DetailFact
				label="Maximum count"
				value={item.maxCount ?? "Unlimited"}
			/>
			<DetailFact
				label="Maximum stack size"
				value={item.maxStackSize}
			/>
		</DetailFacts>
	</DetailSection>
);

const ChargesDetail = ({ item }: { readonly item: EditorItem }) => (
	<DetailSection title="Charges">
		{item.charges === undefined ? (
			<EmptyDetail>This item does not use charges.</EmptyDetail>
		) : (
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
		)}
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

const MergesDetail = ({ item }: { readonly item: EditorItem }) => (
	<DetailSection title="Merges">
		{item.merge === undefined ? (
			<EmptyDetail>This item has no merge behavior.</EmptyDetail>
		) : (
			<div className="grid gap-6">
				{item.merge.map((merge, index) => (
					<MergeDetail
						index={index}
						key={`${merge.effect}-${index}`}
						merge={merge}
					/>
				))}
			</div>
		)}
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
			<div className="ak-list grid gap-1">
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
		case "limits":
			return <LimitsDetail item={item} />;
		case "charges":
			return <ChargesDetail item={item} />;
		case "merges":
			return <MergesDetail item={item} />;
		case "production":
			return <ProductionDetail item={item} />;
	}
};
