import { TriangleAlert } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ItemEstimate, ItemEstimateDiagnostic } from "~/estimate/type/ItemEstimate";
import { formatItemEstimateResultFn } from "~/estimate/ui/formatItemEstimateResultFn";
import { ItemEstimateRouteGraph } from "~/estimate/ui/ItemEstimateRouteGraph";
import { ItemEstimateLoading } from "~/estimate/ui/ItemEstimateLoading";
import { useItemEstimate } from "~/estimate/ui/useItemEstimate";
import { Status } from "~/ui/ui/Status";

const formatQuantityFn = (quantity: number) =>
	Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");

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
}: {
	readonly config: GameConfigSchema.Type;
	readonly estimate: ItemEstimate;
}) =>
	estimate.obtainable ? (
		<ItemEstimateRouteGraph
			config={config}
			header={<ItemEstimateSummary estimate={estimate} />}
			routeSteps={estimate.routeSteps}
		/>
	) : (
		<article
			className="rounded-xl border border-line bg-surface-raised p-4"
			data-ui="EditorItemEstimateHeader"
		>
			<ItemEstimateSummary estimate={estimate} />
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
