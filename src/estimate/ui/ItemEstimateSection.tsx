import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
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
import { useTranslator } from "~/translation/ui/useTranslator";

const formatQuantityFn = (quantity: number) =>
	Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");

const diagnosticTextFn = (diagnostic: ItemEstimateDiagnostic, textFn: (key: string) => string) => {
	switch (diagnostic.kind) {
		case "finite-owner-lifetime-unsupported":
			return textFn(
				"{routeId} depends on finite owner lifetime and production settlement, which static Estimate cannot resolve.",
			).replace("{routeId}", diagnostic.routeId);
		case "joint-output-accounting-unsupported":
			return textFn(
				"{routeId} exceeds the bounded joint-output accounting state space.",
			).replace("{routeId}", diagnostic.routeId);
		case "witness-search-exhausted":
			return textFn(
				"{routeId} exceeds the bounded complete-witness search of {maximumStates} states.",
			)
				.replace("{routeId}", diagnostic.routeId)
				.replace("{maximumStates}", String(diagnostic.maximumStates));
		case "quantity-limit-exceeded":
			return textFn(
				"{factId} × {quantity} exceeds the static estimate limit of {maximumQuantity} ({source}).",
			)
				.replace("{factId}", diagnostic.factId)
				.replace("{quantity}", formatQuantityFn(diagnostic.quantity))
				.replace("{maximumQuantity}", String(diagnostic.maximumQuantity))
				.replace("{source}", diagnostic.source);
		case "cycle":
			return textFn("Cycle on route {routeId}: {factIds}.")
				.replace("{routeId}", diagnostic.routeId)
				.replace("{factIds}", diagnostic.factIds.join(" → "));
		case "unreachable":
			return (
				diagnostic.routeId === undefined
					? textFn("{factId} × {quantity} has no complete acquisition route.")
					: textFn(
							"{factId} × {quantity} has no complete acquisition route through {routeId}.",
						).replace("{routeId}", diagnostic.routeId)
			)
				.replace("{factId}", diagnostic.factId)
				.replace("{quantity}", formatQuantityFn(diagnostic.quantity));
		case "zero-yield":
			return textFn("Route {routeId} can never yield {factId}.")
				.replace("{routeId}", diagnostic.routeId)
				.replace("{factId}", diagnostic.factId);
	}
};

const ItemEstimateHeading = () => (
	<h2 className="text-lg font-semibold text-foreground">
		<Tx label="Approximate acquisition path" />
	</h2>
);

const ItemEstimateSummary = ({ estimate }: { readonly estimate: ItemEstimate }) => (
	<div className="flex min-w-0 flex-1 items-center justify-between gap-4">
		<ItemEstimateHeading />
		<p className="shrink-0 font-semibold tabular-nums text-foreground">
			{estimate.obtainable ? (
				formatItemEstimateResultFn(estimate)
			) : (
				<Tx label={estimate.status === "partial" ? "Indeterminate" : "Unreachable"} />
			)}
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
}) => {
	const translator = useTranslator();
	return estimate.status === "unreachable" ? (
		limit === undefined ? (
			<Status
				dataUi="EditorItemEstimateUnreachable"
				icon={Unlink}
				title={<Tx label="This item is unreachable." />}
				description={<Mx label="Estimate unreachable description" />}
				size="large"
				variant="flat"
			/>
		) : (
			<EditorRootCard dataUi="EditorItemEstimateUnreachableCard">
				<Status
					dataUi="EditorItemEstimateUnreachable"
					icon={Unlink}
					title={<Tx label="This item is unreachable." />}
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
				<Mx label="Estimate incomplete description" />
				<ul className="grid gap-2">
					{estimate.diagnostics.slice(0, limit).map((diagnostic, index) => (
						<li key={`${diagnostic.kind}:${index}`}>
							{diagnosticTextFn(diagnostic, translator.textFn)}
						</li>
					))}
				</ul>
			</div>
		</EditorRootCard>
	);
};

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
					title={<Tx label="Estimate calculation failed" />}
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
