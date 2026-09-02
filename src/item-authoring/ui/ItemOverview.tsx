import {
	ArrowRight,
	BatteryCharging,
	Clock3,
	Combine,
	Factory,
	Image as ImageIcon,
	MapPinned,
	Network,
	ShieldAlert,
	ShieldCheck,
	type LucideIcon,
} from "lucide-react";
import { type ReactNode, useMemo } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorOverviewCard } from "~/authoring-shell/ui/EditorOverviewCard";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { formatItemEstimateResultFn } from "~/estimate/ui/formatItemEstimateResultFn";
import { useItemEstimate } from "~/estimate/ui/useItemEstimate";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";
import { readItemConnectionsFn } from "~/item-authoring/fn/readItemConnectionsFn";
import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";
import type { SectionDescriptor, SectionId } from "~/item-authoring/type/Section";
import { readAuthoredItemLinesFn } from "~/production-line/fn/readAuthoredItemLinesFn";
import { LinkButtonLink } from "~/ui/ui/LinkButton";

const OverviewIconBySection = {
	action: MapPinned,
	artwork: ImageIcon,
	charges: BatteryCharging,
	delete: ShieldCheck,
	estimate: Clock3,
	merges: Combine,
	production: Factory,
	connections: Network,
} as const satisfies Record<Exclude<SectionId, "identity">, LucideIcon>;

const ItemOverviewCard = ({
	children,
	icon: Icon,
	itemUid,
	projectId,
	section,
}: {
	readonly children: ReactNode;
	readonly icon: LucideIcon;
	readonly itemUid: string;
	readonly projectId: string;
	readonly section: SectionDescriptor;
}) => {
	if (section.id === "identity") return null;
	return (
		<EditorOverviewCard
			body={children}
			dataUi={`EditorItemOverview${section.id}Card`}
			footerRight={
				<LinkButtonLink
					className="inline-flex items-center gap-1.5"
					data-section-id={section.id}
					data-ui="EditorItemOverviewLink"
					params={{
						itemUid,
						projectId,
						sectionId: section.id,
					}}
					search={
						section.id === "connections"
							? {
									filter: "required-by",
								}
							: {}
					}
					to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
				>
					{section.label}
					<ArrowRight className="size-4" />
				</LinkButtonLink>
			}
			icon={Icon}
			title={section.label}
		/>
	);
};

/** Presents a compact, routed summary for every detail section supported by one item. */
export const ItemOverview = ({ item }: { readonly item: ItemSchema.Type }) => {
	const project = useEditorProject();
	const estimate = useItemEstimate(project, item.id);
	const requiredByItems = useMemo(
		() => readItemConnectionsFn(project.config, item.id, "required-by"),
		[
			item.id,
			project.config,
		],
	);
	const deleteBlockers = useMemo(
		() =>
			readDeleteBlockersFn({
				config: project.config,
				itemId: item.id,
			}),
		[
			item.id,
			project.config,
		],
	);
	const enabledProductionLineCount = readAuthoredItemLinesFn(item).filter(
		(line) => line.enable,
	).length;
	const progressArtworkCount = item.asset.sources?.length ?? 0;
	const estimateSummary =
		estimate.status === "ready"
			? formatItemEstimateResultFn(estimate.estimate)
			: estimate.status === "loading"
				? "Calculating…"
				: "Unavailable";
	const summaries = {
		action: item.type === "space" ? (item.enable ? "Enabled" : "Disabled") : null,
		artwork: (
			<div className="flex items-center gap-3">
				<EditorItemThumbnail
					className="shrink-0"
					resourceIds={item.asset.default}
					size="sm"
				/>
				<div className="text-sm leading-6 text-muted">
					<p className="font-medium text-foreground">
						{item.asset.default.length} default{" "}
						{item.asset.default.length === 1 ? "layer" : "layers"}
					</p>
					<p>
						{progressArtworkCount === 0
							? "No progress artwork"
							: `${progressArtworkCount} progress ${progressArtworkCount === 1 ? "state" : "states"}`}
					</p>
				</div>
			</div>
		),
		charges: item.charges === undefined ? "Disabled" : "Enabled",
		delete:
			deleteBlockers.length === 0
				? "Can be deleted"
				: `Blocked by ${deleteBlockers.length} ${deleteBlockers.length === 1 ? "reference" : "references"}`,
		estimate: estimateSummary,
		merges: item.merge === undefined || item.merge.length === 0 ? "Disabled" : "Enabled",
		production: `${enabledProductionLineCount} enabled ${enabledProductionLineCount === 1 ? "line" : "lines"}`,
		connections:
			requiredByItems.length === 0
				? "Not required by any item"
				: `${requiredByItems.length} ${requiredByItems.length === 1 ? "item requires" : "items require"} this item`,
	} as const satisfies Record<Exclude<SectionId, "identity">, ReactNode>;

	return (
		<section
			className="flex flex-col gap-[var(--ak-viewport-gap)]"
			data-ui="EditorItemOverview"
		>
			{readSectionsFn(item).map((section) =>
				section.id === "identity" ? null : (
					<ItemOverviewCard
						icon={
							section.id === "delete" && deleteBlockers.length > 0
								? ShieldAlert
								: OverviewIconBySection[section.id]
						}
						itemUid={item.uid}
						key={section.id}
						projectId={project.projectId}
						section={section}
					>
						{summaries[section.id]}
					</ItemOverviewCard>
				),
			)}
		</section>
	);
};
