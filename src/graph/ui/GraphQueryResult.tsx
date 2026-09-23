import { GraphNodeReference } from "~/graph/ui/GraphNodeReference";
import { GitBranch, LoaderCircle, TriangleAlert } from "lucide-react";
import type { EditorGraphQueryState } from "~/graph/ui/useEditorGraphQuery";
import { GraphEdgeRow } from "~/graph/ui/GraphEdgeRow";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Status } from "~/ui/ui/Status";

/** Shared graph results preserve bounded answers and explicit empty/error/loading states. */
export const GraphQueryResult = ({
	state,
	showPaths = false,
}: {
	readonly state: EditorGraphQueryState;
	readonly showPaths?: boolean;
}) => {
	const translator = useTranslator();
	if (state.status === "loading")
		return (
			<Status
				icon={LoaderCircle}
				title={translator.textFn("Loading relationships…")}
				variant="flat"
			/>
		);
	if (state.status === "error")
		return (
			<Status
				icon={TriangleAlert}
				title={translator.textFn("Relationships could not be loaded")}
				description={state.message}
				variant="flat"
			/>
		);
	const result = state.result;
	return (
		<div
			className="ak-list grid content-start gap-2"
			data-ui="EditorGraphResult"
		>
			{result.truncated ? (
				<p
					className="text-sm text-muted"
					data-ui="EditorGraphTruncated"
				>
					{translator.textFn("Only part of the graph is shown.")}{" "}
					{result.reasons
						.map((reason) =>
							translator.textFn(
								(
									{
										depth: "Depth limit",
										limit: "Result limit",
										expansions: "Exploration limit",
										timeout: "Time limit",
									} as const
								)[reason],
							),
						)
						.join(" · ")}
				</p>
			) : null}
			{result.edges.length === 0 ? (
				<Status
					icon={GitBranch}
					title={translator.textFn(
						result.truncated
							? "No relationship found within these limits"
							: "No matching relationships",
					)}
					variant="flat"
				/>
			) : null}
			{showPaths && result.paths.length > 0 ? (
				<details
					className="rounded-lg border border-line p-3"
					data-ui="EditorGraphPaths"
					open
				>
					<summary className="cursor-pointer text-sm font-semibold">
						{translator.textFn("Paths")}
					</summary>
					<div className="mt-3 grid gap-2">
						{result.paths.map((path) => (
							<div
								className="flex flex-wrap items-center gap-2"
								key={JSON.stringify(path.edges)}
							>
								{path.nodes.map((id, index) => (
									<span
										key={`${index}:${id}`}
										className="inline-flex items-center gap-2"
									>
										{index === 0 ? null : <span className="text-muted">→</span>}
										<GraphNodeReference
											id={id}
											node={result.nodes.find((node) => node.id === id)}
										/>
									</span>
								))}
							</div>
						))}
					</div>
				</details>
			) : null}
			{result.edges.map((edge) => (
				<GraphEdgeRow
					key={edge.id}
					edge={edge}
					nodes={result.nodes}
					operation={result.operations.find(
						(operation) => operation.id === edge.operationId,
					)}
				/>
			))}
		</div>
	);
};
