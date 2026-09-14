import { TriangleAlert, Unlink } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ItemEstimate, ItemEstimateDiagnostic } from "~/estimate/type/ItemEstimate";
import { formatItemEstimateResultFn } from "~/estimate/ui/formatItemEstimateResultFn";
import { ItemEstimateRouteGraph } from "~/estimate/ui/ItemEstimateRouteGraph";
import { ItemEstimateLoading } from "~/estimate/ui/ItemEstimateLoading";
import { useItemEstimate } from "~/estimate/ui/useItemEstimate";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Status } from "~/ui/ui/Status";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";

const formatQuantityFn = (quantity: number) =>
	Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");

const diagnosticTextFn = (diagnostic: ItemEstimateDiagnostic) => {
	switch (diagnostic.kind) {
		case "finite-owner-lifetime-unsupported":
			return `${diagnostic.routeId} depends on finite owner lifetime and production settlement, which static Estimate cannot resolve.`;
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

const ItemEstimateHeading = () => (
	<h2 className="text-lg font-semibold text-foreground">Approximate acquisition path</h2>
);

const ItemEstimateSummary = ({ estimate }: { readonly estimate: ItemEstimate }) => (
	<div className="flex min-w-0 flex-1 items-center justify-between gap-4">
		<ItemEstimateHeading />
		<p className="shrink-0 font-semibold tabular-nums text-foreground">
			{formatItemEstimateResultFn(estimate)}
		</p>
	</div>
);

const ItemEstimateResult = ({
	config,
	estimate,
	limit,
}: {
	readonly config: GameConfigSchema.Type;
	readonly estimate: ItemEstimate;
	readonly limit?: number;
}) =>
	estimate.status === "unreachable" ? (
		limit === undefined ? (
			<Status
				dataUi="EditorItemEstimateUnreachable"
				icon={Unlink}
				title="This item is unreachable."
				description="No complete acquisition path was found from the project's starting items using the current configuration."
				size="large"
				variant="flat"
			/>
		) : (
			<EditorRootCard dataUi="EditorItemEstimateUnreachableCard">
				<Status
					dataUi="EditorItemEstimateUnreachable"
					icon={Unlink}
					title="This item is unreachable."
					variant="flat"
				/>
			</EditorRootCard>
		)
	) : estimate.obtainable ? (
		<ItemEstimateRouteGraph
			config={config}
			header={<ItemEstimateSummary estimate={estimate} />}
			routeSteps={estimate.routeSteps}
			limit={limit}
		/>
	) : (
		<EditorRootCard
			className="gap-0"
			dataUi="EditorItemEstimateHeader"
		>
			<ItemEstimateSummary estimate={estimate} />
			<div className="mt-4 grid gap-3 border-t border-line/70 pt-4 text-sm leading-relaxed text-muted">
				<p className="font-medium text-foreground">
					The bounded static analysis could not produce stable totals; see the diagnostic
					for the exact limit.
				</p>
				<ul className="grid gap-2">
					{estimate.diagnostics.slice(0, limit).map((diagnostic, index) => (
						<li key={`${diagnostic.kind}:${index}`}>{diagnosticTextFn(diagnostic)}</li>
					))}
				</ul>
			</div>
		</EditorRootCard>
	);

/** Shares the captured estimate between the full section and its two-entry overview. */
export const ItemEstimateSection = ({
	itemId,
	previewItemUid,
}: {
	readonly itemId: string;
	readonly previewItemUid?: string;
}) => {
	const project = useEditorProject();
	const state = useItemEstimate(project, itemId);
	return (
		<section
			className="grid content-start gap-4 data-[ui-unreachable=true]:content-stretch"
			{...readDataUiFn({
				dataUi: "EditorItemEstimateSection",
				state: {
					unreachable:
						state.status === "ready" && state.estimate.status === "unreachable",
				},
			})}
		>
			{state.status === "ready" ? null : (
				<EditorRootCard dataUi="EditorItemEstimateHeader">
					<ItemEstimateHeading />
				</EditorRootCard>
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
					limit={previewItemUid === undefined ? undefined : 2}
				/>
			) : null}
		</section>
	);
};
