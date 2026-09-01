import { ArrowRight, Calculator, Info, TriangleAlert } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ItemEstimate, ItemEstimateDiagnostic } from "~/estimate/type/ItemEstimate";
import type { EstimateRouteStep } from "~/estimate/type/EstimateProjection";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { ItemEstimateRouteGraph } from "~/estimate/ui/ItemEstimateRouteGraph";
import { ItemEstimateLoading } from "~/estimate/ui/ItemEstimateLoading";
import { useItemEstimate } from "~/estimate/ui/useItemEstimate";
import { Tooltip } from "~/ui/ui/Tooltip";
import { Status } from "~/ui/ui/Status";

const formatQuantityFn = (quantity: number) =>
	Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");

const formatRuntimeFn = (runtimeMs: number) => formatDurationFn(runtimeMs);

const diagnosticTextFn = (diagnostic: ItemEstimateDiagnostic) => {
	switch (diagnostic.kind) {
		case "joint-output-accounting-unsupported":
			return `${diagnostic.routeId} exceeds the bounded joint-output accounting state space.`;
		case "witness-search-exhausted":
			return `${diagnostic.routeId} exceeds the bounded complete-witness search of ${diagnostic.maximumStates} states.`;
		case "quantity-limit-exceeded":
			return `${diagnostic.factId} × ${formatQuantityFn(diagnostic.quantity)} exceeds the static estimate limit of ${diagnostic.maximumQuantity} (${diagnostic.source}).`;
		case "cycle":
			return `Cycle on route ${diagnostic.routeId}: ${diagnostic.factIds.join(" → ")}.`;
		case "unreachable":
			return `${diagnostic.factId} × ${formatQuantityFn(diagnostic.quantity)} has no complete acquisition route${diagnostic.routeId === undefined ? "" : ` through ${diagnostic.routeId}`}.`;
		case "zero-yield":
			return `Route ${diagnostic.routeId} can never yield ${diagnostic.factId}.`;
	}
};

const readRouteSourceItemIdFn = (route: EstimateRouteStep) => {
	switch (route.metadata?.kind) {
		case "line-output":
			return route.metadata.ownerItemId;
		case "line-charge-depletion":
			return route.metadata.chargedItemId;
		case "merge-output":
			return route.metadata.sourceItemId;
		case "temporary-expiry":
			return route.metadata.itemId;
		case undefined:
			return undefined;
	}
};

const ItemEstimateMethodDetails = ({
	config,
	estimate,
}: {
	readonly config: GameConfigSchema.Type;
	readonly estimate: ItemEstimate;
}) => {
	const route = estimate.obtainable ? estimate.route : undefined;
	const sourceItemId = route === undefined ? undefined : readRouteSourceItemIdFn(route);
	const sourceTitle =
		sourceItemId === undefined
			? undefined
			: (config.items[sourceItemId]?.title ?? sourceItemId);
	const targetTitle =
		route === undefined ? undefined : (config.items[route.factId]?.title ?? route.factId);
	return (
		<div
			className="min-w-0"
			data-ui="EditorItemEstimateMethod"
		>
			<header className="flex items-start gap-3 border-b border-line/70 pb-3">
				<Calculator className="mt-0.5 size-5 shrink-0 text-sky-700" />
				<div>
					<h3 className="font-semibold text-foreground">
						Approximate dependency estimator
					</h3>
					<p className="mt-1 text-xs text-muted">
						Optimistic bounded-distribution analysis
					</p>
				</div>
			</header>
			<p className="py-3 text-xs leading-relaxed text-muted">
				Uses authored dependencies to select an optimistic acquisition path and estimate its
				critical-path duration.
			</p>
			<div className="border-t border-line/70 pt-3">
				{sourceTitle !== undefined && targetTitle !== undefined ? (
					<div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
						<span>{sourceTitle}</span>
						<ArrowRight className="size-4 shrink-0 text-muted" />
						<span>{targetTitle}</span>
					</div>
				) : targetTitle !== undefined ? (
					<p className="text-sm font-semibold text-foreground">{targetTitle}</p>
				) : (
					<p className="text-xs leading-relaxed text-muted">
						{estimate.status === "partial"
							? "No duration is claimed for this incomplete path."
							: "No route satisfied every required dependency."}
					</p>
				)}
			</div>
		</div>
	);
};

const ItemEstimateHeading = ({
	config,
	estimate,
}: {
	readonly config?: GameConfigSchema.Type;
	readonly estimate?: ItemEstimate;
}) => (
	<header className="flex items-center gap-1">
		<h2 className="text-lg font-semibold text-foreground">Approximate acquisition path</h2>
		{config === undefined || estimate === undefined ? null : (
			<Tooltip
				content={
					<ItemEstimateMethodDetails
						config={config}
						estimate={estimate}
					/>
				}
				contentClassName="w-[min(40rem,calc(100vw-2rem))] max-w-none p-4"
				placement="bottom-start"
			>
				<button
					type="button"
					data-ui="EditorInfoTooltip"
					className="grid size-7 min-h-0 min-w-0 shrink-0 cursor-help place-items-center rounded-full border-0 bg-transparent p-0 text-muted hover:text-foreground"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
					}}
				>
					<Info className="size-4" />
				</button>
			</Tooltip>
		)}
	</header>
);

const ItemEstimateSummary = ({
	config,
	estimate,
}: {
	readonly config: GameConfigSchema.Type;
	readonly estimate: ItemEstimate;
}) => (
	<div className="flex min-w-0 flex-1 items-center justify-between gap-4">
		<ItemEstimateHeading
			config={config}
			estimate={estimate}
		/>
		<p className="shrink-0 font-semibold tabular-nums text-foreground">
			{estimate.obtainable
				? `≈ ${formatRuntimeFn(estimate.durationMs)}`
				: estimate.status === "partial"
					? "Indeterminate"
					: "Unreachable"}
		</p>
	</div>
);

const ItemEstimateResult = ({
	config,
	estimate,
}: {
	readonly config: GameConfigSchema.Type;
	readonly estimate: ItemEstimate;
}) =>
	estimate.obtainable ? (
		<ItemEstimateRouteGraph
			config={config}
			header={
				<ItemEstimateSummary
					config={config}
					estimate={estimate}
				/>
			}
			routeSteps={estimate.routeSteps}
		/>
	) : (
		<article
			className="rounded-xl border border-line bg-surface-raised p-4"
			data-ui="EditorItemEstimateHeader"
		>
			<ItemEstimateSummary
				config={config}
				estimate={estimate}
			/>
			<div className="mt-4 grid gap-3 border-t border-line/70 pt-4 text-sm leading-relaxed text-muted">
				<p className="font-medium text-foreground">
					{estimate.status === "partial"
						? "The bounded static analysis could not produce stable totals; see the diagnostic for the exact limit."
						: "The authored dependency graph contains no complete route from the configured starting facts."}
				</p>
				<ul className="grid gap-2">
					{estimate.diagnostics.map((diagnostic, index) => (
						<li key={`${diagnostic.kind}:${index}`}>{diagnosticTextFn(diagnostic)}</li>
					))}
				</ul>
			</div>
		</article>
	);

/** Shows the shared static estimate in one item's read-only Estimate section. */
export const ItemEstimateSection = ({ itemId }: { readonly itemId: string }) => {
	const project = useEditorProject();
	const state = useItemEstimate(project, itemId);
	return (
		<section
			className="grid gap-4"
			data-ui="EditorItemEstimateSection"
		>
			{state.status === "ready" ? null : (
				<div
					className="rounded-xl border border-line bg-surface-raised p-4"
					data-ui="EditorItemEstimateHeader"
				>
					<ItemEstimateHeading />
				</div>
			)}
			{state.status === "loading" ? <ItemEstimateLoading /> : null}
			{state.status === "error" ? (
				<Status
					dataUi="EditorItemEstimateError"
					description={state.message}
					icon={TriangleAlert}
					title="Estimate calculation failed"
				/>
			) : null}
			{state.status === "ready" ? (
				<ItemEstimateResult
					config={state.config}
					estimate={state.estimate}
				/>
			) : null}
		</section>
	);
};
