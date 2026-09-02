import {
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
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { formatItemEstimateResultFn } from "~/estimate/ui/formatItemEstimateResultFn";
import { useItemEstimate } from "~/estimate/ui/useItemEstimate";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";
import { readRequiredByItemsFn } from "~/item-authoring/fn/readRequiredByItemsFn";
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
	"required-by": Network,
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
		<EditorRootCard
			className="gap-4"
			dataUi={`EditorItemOverview${section.id}Card`}
		>
			<div className="grid gap-4">
				<LinkButtonLink
					className="flex w-fit items-center gap-2"
					data-section-id={section.id}
					data-ui="EditorItemOverviewLink"
					params={{
						itemUid,
						projectId,
						sectionId: section.id,
					}}
					to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
				>
					<Icon className="size-4" />
					<h2 className="font-semibold">{section.label}</h2>
				</LinkButtonLink>
				{children}
			</div>
		</EditorRootCard>
	);
};

/** Presents a compact, routed summary for every detail section supported by one item. */
export const ItemOverview = ({ item }: { readonly item: ItemSchema.Type }) => {
	const project = useEditorProject();
	const estimate = useItemEstimate(project, item.id);
	const requiredByItems = useMemo(
		() => readRequiredByItemsFn(project.config, item.id),
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
		"required-by":
			requiredByItems.length === 0
				? "Not required by any item"
				: `${requiredByItems.length} ${requiredByItems.length === 1 ? "item" : "items"}`,
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
						<p className="text-lg font-semibold text-foreground">
							{summaries[section.id]}
						</p>
					</ItemOverviewCard>
				),
			)}
		</section>
	);
};
