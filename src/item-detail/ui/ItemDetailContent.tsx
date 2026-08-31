import { motion } from "motion/react";
import { match } from "ts-pattern";

import type { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import type { ItemDetailTarget } from "~/item-detail-frame/type/ItemDetailControl";
import { ItemDefinitionInfoTab } from "~/item-detail/ui/ItemDefinitionInfoTab";
import { ItemInfoTab } from "~/item-detail/ui/ItemInfoTab";
import { ItemQueueTab } from "~/item-detail/ui/ItemQueueTab";
import { ItemSourcesTab } from "~/item-detail/ui/ItemSourcesTab";
import type { useDefinitionItemDetailSceneController } from "~/item-detail/ui/useDefinitionItemDetailSceneController";
import type { useItemDetailNavigationController } from "~/item-detail/ui/useItemDetailNavigationController";
import { itemDetailTransition } from "~/item-detail/ui/useItemDetailMotion";
import type { useRuntimeItemDetailSceneController } from "~/item-detail/ui/useRuntimeItemDetailSceneController";
import { ItemLinesTab } from "~/item-line-detail/ui/ItemLinesTab";
import type { ItemLineSummaryIdentityRenderer } from "~/item-line-detail/ui/ItemLineSummary";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

interface RuntimeItemDetailContentProps {
	readonly kind: "runtime";
	readonly definitionItemId?: string;
	readonly disabled: boolean;
	readonly identity?: useRuntimeItemDetailSceneController.IdentityProjection;
	readonly info?: useRuntimeItemDetailSceneController.Output["info"];
	readonly linesSearchQuery?: string;
	readonly lines?: useRuntimeItemDetailSceneController.Output["lines"];
	readonly queue?: useRuntimeItemDetailSceneController.QueueProjection;
	readonly queueStale: boolean;
	readonly renderLineIdentity?: ItemLineSummaryIdentityRenderer;
	readonly sources?: useItemDetailNavigationController.SourcesProjection;
	readonly stale: boolean;
	readonly target: Extract<
		ItemDetailTarget,
		{
			readonly kind: "runtime";
		}
	>;
}

interface DefinitionItemDetailContentProps {
	readonly kind: "definition";
	readonly definition: Extract<
		useDefinitionItemDetailSceneController.DefinitionProjection,
		{
			readonly kind: "available";
		}
	>;
	readonly disabled: boolean;
	readonly sources: useItemDetailNavigationController.SourcesProjection;
	readonly target: Extract<
		ItemDetailTarget,
		{
			readonly kind: "definition";
		}
	>;
}

type ItemDetailContentProps = RuntimeItemDetailContentProps | DefinitionItemDetailContentProps;

const ItemInfoContent = ({
	disabled,
	identity,
	info,
	stale,
}: {
	readonly disabled: boolean;
	readonly identity?: useRuntimeItemDetailSceneController.IdentityProjection;
	readonly info?: useRuntimeItemDetailSceneController.Output["info"];
	readonly stale: boolean;
}) => {
	if (identity?.kind !== "available" || info?.kind !== "available") {
		return (
			<div className="grid flex-1 place-items-center text-sm text-muted">
				Item detail is unavailable.
			</div>
		);
	}
	return (
		<div
			className="min-h-0 flex-1 data-[ui-disabled=true]:opacity-70"
			inert={disabled}
			{...readDataUiFn({
				dataUi: "ItemInfoContent",
				state: {
					disabled,
				},
			})}
		>
			<ItemInfoTab
				info={info}
				stale={stale}
			/>
		</div>
	);
};

const ItemLinesContent = ({
	definitionItemId,
	disabled,
	initialQuery,
	lines,
	renderIdentity,
	stale,
}: {
	readonly definitionItemId?: string;
	readonly disabled: boolean;
	readonly initialQuery?: string;
	readonly lines?: useRuntimeItemDetailSceneController.Output["lines"];
	readonly renderIdentity?: ItemLineSummaryIdentityRenderer;
	readonly stale: boolean;
}) => {
	if (lines?.kind !== "available") {
		return (
			<div className="grid flex-1 place-items-center text-sm text-muted">
				Line detail is unavailable.
			</div>
		);
	}
	return (
		<ItemLinesTab
			definitionItemId={definitionItemId}
			disabled={disabled}
			initialQuery={initialQuery}
			lines={lines}
			renderIdentity={renderIdentity}
			stale={stale}
		/>
	);
};

const ItemQueueContent = ({
	disabled,
	queue,
	stale,
}: {
	readonly disabled: boolean;
	readonly queue?: useRuntimeItemDetailSceneController.QueueProjection;
	readonly stale: boolean;
}) => {
	if (stale) {
		return (
			<div
				className="grid flex-1 place-items-center px-4 text-center text-sm text-muted"
				data-ui="ItemQueueStale"
			>
				Queue is unavailable because this item no longer exists.
			</div>
		);
	}
	if (queue?.kind !== "available") {
		return (
			<div className="grid flex-1 place-items-center text-sm text-muted">
				Queue detail is unavailable.
			</div>
		);
	}
	return (
		<ItemQueueTab
			disabled={disabled}
			queue={queue}
		/>
	);
};

const ItemSourcesContent = ({
	disabled,
	sources,
	stale = false,
}: {
	readonly disabled: boolean;
	readonly sources?: useItemDetailNavigationController.SourcesProjection;
	readonly stale?: boolean;
}) => {
	if (sources?.kind !== "available" || sources.source.length === 0) {
		return (
			<div className="grid flex-1 place-items-center text-sm text-muted">
				Source detail is unavailable.
			</div>
		);
	}
	return (
		<ItemSourcesTab
			disabled={disabled}
			sources={sources}
			stale={stale}
		/>
	);
};

const RuntimeItemDetailContent = ({
	definitionItemId,
	disabled,
	identity,
	info,
	linesSearchQuery,
	lines,
	queue,
	queueStale,
	renderLineIdentity,
	sources,
	stale,
	tab,
}: Omit<RuntimeItemDetailContentProps, "kind" | "target"> & {
	readonly tab: ItemDetailTabEnumSchema.Type;
}) =>
	match(tab)
		.with("info", () => (
			<ItemInfoContent
				disabled={disabled}
				identity={identity}
				info={info}
				stale={stale}
			/>
		))
		.with("lines", () => (
			<ItemLinesContent
				definitionItemId={definitionItemId}
				disabled={disabled}
				initialQuery={linesSearchQuery}
				lines={lines}
				renderIdentity={renderLineIdentity}
				stale={stale}
			/>
		))
		.with("queue", () => (
			<ItemQueueContent
				disabled={disabled}
				queue={queue}
				stale={stale || queueStale}
			/>
		))
		.with("sources", () => (
			<ItemSourcesContent
				disabled={disabled}
				sources={sources}
				stale={stale}
			/>
		))
		.exhaustive();

export const ItemDetailContent = (props: ItemDetailContentProps) => (
	<motion.div
		key={`${props.target.kind}:${props.target.itemId}:${props.target.tab}:${
			props.target.kind === "runtime" ? (props.target.linesSearchQuery ?? "") : ""
		}`}
		className="flex min-h-0 flex-1 flex-col"
		data-ui="ItemDetailContentTransition"
		data-tab={props.target.tab}
		initial={{
			opacity: 0,
			y: 6,
		}}
		animate={{
			opacity: 1,
			y: 0,
		}}
		transition={itemDetailTransition}
	>
		{props.kind === "runtime" ? (
			<RuntimeItemDetailContent
				definitionItemId={props.definitionItemId}
				disabled={props.disabled}
				identity={props.identity}
				info={props.info}
				linesSearchQuery={props.linesSearchQuery}
				lines={props.lines}
				queue={props.queue}
				queueStale={props.queueStale}
				renderLineIdentity={props.renderLineIdentity}
				sources={props.sources}
				stale={props.stale}
				tab={props.target.tab}
			/>
		) : props.target.tab === "info" ? (
			<ItemDefinitionInfoTab definition={props.definition} />
		) : (
			<ItemSourcesContent
				disabled={props.disabled}
				sources={props.sources}
			/>
		)}
	</motion.div>
);
