import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorItemEstimateRouteStep } from "~/editor/estimator/EditorItemEstimate";
import { formatItemDurationFx } from "~/ui/item-detail/formatItemDurationFx";

const formatQuantity = (quantity: number) =>
	Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");

const formatRuntime = (runtimeMs: number) =>
	RendererRuntime.runSync(formatItemDurationFx(runtimeMs));

const formatSources = (sources: ReadonlyArray<string>) =>
	sources.map((source) => source.replaceAll("-", " ")).join(", ");

/** Renders every selected acquisition fact once and links shared prerequisites by route ID. */
export const EditorItemEstimateRouteGraph = ({
	routeSteps,
}: {
	readonly routeSteps: ReadonlyArray<EditorItemEstimateRouteStep>;
}) => {
	const routeByFactId = new Map(
		routeSteps.map((route) => [
			route.factId,
			route,
		]),
	);
	return (
		<ul className="grid gap-3">
			{routeSteps.map((route) => (
				<li
					className="grid gap-1"
					data-ui="EditorItemEstimateRouteStep"
					key={route.factId}
				>
					<span>
						<strong className="font-medium text-foreground">{route.factId}</strong> ×{" "}
						{formatQuantity(route.quantity)} via {route.routeId} (
						{formatRuntime(route.durationMs)})
					</span>
					{route.rootQuantity > 0 ? (
						<span className="text-muted-foreground">
							Includes {formatQuantity(route.rootQuantity)} from authored start facts.
						</span>
					) : null}
					{route.requirements.length > 0 ? (
						<ul className="ml-4 grid gap-1 border-l border-line/70 pl-3">
							{route.requirements.map((requirement, index) => {
								const acquisition =
									requirement.acquisitionFactId === undefined
										? undefined
										: routeByFactId.get(requirement.acquisitionFactId);
								return (
									<li key={`${requirement.factId}:${requirement.usage}:${index}`}>
										{requirement.usage}: {requirement.factId} ×{" "}
										{formatQuantity(requirement.quantity)} (
										{formatSources(requirement.sources)})
										{acquisition === undefined
											? null
											: ` → ${acquisition.routeId}`}
									</li>
								);
							})}
						</ul>
					) : null}
				</li>
			))}
		</ul>
	);
};
