import { useEffect, useMemo, useState } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type { EditorItemOriginFlow } from "~/bridge/item/editor/EditorItemOriginFlow";
import type {
	EditorOriginFlowDirection,
	EditorOriginFlowSelection,
} from "~/ui/item/editor/readEditorOriginFlowHighlightFx";
import { EditorItemFlowSearch } from "~/ui/item/editor/EditorItemFlowSearch";
import { EditorOriginFlowCanvas } from "~/ui/item/editor/EditorOriginFlowCanvas";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/editorItemOriginFlowLayout";
import { useEditorItemOriginFlow } from "~/ui/item/editor/useEditorItemOriginFlow";
import { useEditorItemSearchOptions } from "~/ui/item/editor/useEditorItemSearchOptions";

const EmptyFlowBackbones: ReadonlyMap<
	string,
	ReadonlyArray<EditorItemOriginFlowLayoutPoint>
> = new Map();
const EmptyFlowPositions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode> = new Map();
interface EditorOriginFlowSectionProps {
	readonly direction?: EditorOriginFlowDirection;
	readonly focusItemId?: string;
	readonly focusRequestKey?: number;
	readonly itemId?: string;
	readonly mode: "all" | "item";
}

const EditorLocalOriginFlowSearch = ({
	flow,
	onChange,
	value,
}: {
	readonly flow: EditorItemOriginFlow;
	readonly value: string;
	readonly onChange: (value: string) => void;
}) => {
	const { items, options } = useEditorItemSearchOptions();
	const flowItemIds = useMemo(
		() => new Set(flow.nodes.map((node) => node.itemId)),
		[
			flow.nodes,
		],
	);
	const flowSearchOptions = useMemo(
		() => options.filter((option) => flowItemIds.has(option.id)),
		[
			flowItemIds,
			options,
		],
	);
	return (
		<EditorItemFlowSearch
			items={items}
			onChange={onChange}
			options={flowSearchOptions}
			value={value}
		/>
	);
};

/** Visualizes either the complete game flow or one directed item flow. */
export const EditorOriginFlowSection = ({
	direction = "income",
	focusItemId,
	focusRequestKey,
	itemId,
	mode,
}: EditorOriginFlowSectionProps) => {
	const project = useEditorProject();
	const flowState = useEditorItemOriginFlow(project.config, mode === "item" ? itemId : undefined);
	const flow = flowState.flow;
	const backbones = flowState.status === "ready" ? flowState.backbones : EmptyFlowBackbones;
	const positions = flowState.status === "ready" ? flowState.positions : EmptyFlowPositions;
	const [selection, setSelection] = useState<EditorOriginFlowSelection>();
	const [searchedItemId, setSearchedItemId] = useState("");
	const [localFocusRequestKey, setLocalFocusRequestKey] = useState(0);
	useEffect(() => {
		setSelection(undefined);
		setSearchedItemId("");
		setLocalFocusRequestKey(0);
	}, [
		flow,
	]);
	const isReady = flowState.status === "ready" && flow !== undefined;
	const effectiveFocusItemId =
		mode === "item" && searchedItemId.length > 0 ? searchedItemId : focusItemId;
	const effectiveFocusRequestKey = mode === "item" ? localFocusRequestKey : focusRequestKey;
	const focusNodeId = useMemo(() => {
		if (!isReady || effectiveFocusItemId === undefined) return undefined;
		return flow.nodes.find((node) => node.itemId === effectiveFocusItemId)?.id;
	}, [
		effectiveFocusItemId,
		flow,
		isReady,
	]);
	useEffect(() => {
		if (focusNodeId === undefined) return;
		setSelection({
			id: focusNodeId,
			kind: "node",
		});
	}, [
		effectiveFocusRequestKey,
		focusNodeId,
	]);

	return (
		<section
			className="h-full min-h-[34rem] overflow-hidden rounded-lg border border-l-2 border-line bg-surface-raised"
			data-ui="EditorOriginFlowSection"
		>
			{isReady ? (
				<div
					className={
						mode === "item"
							? "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]"
							: "h-full min-h-0"
					}
				>
					{mode === "item" ? (
						<div className="border-b border-line bg-surface p-3">
							<EditorLocalOriginFlowSearch
								flow={flow}
								onChange={(value) => {
									setSearchedItemId(value);
									setLocalFocusRequestKey((current) => current + 1);
								}}
								value={searchedItemId}
							/>
						</div>
					) : null}
					<div className="relative h-full min-h-0 bg-canvas">
						<EditorOriginFlowCanvas
							backbones={backbones}
							direction={direction}
							fitContent={mode === "item"}
							flow={flow}
							focusNodeId={focusNodeId}
							focusRequestKey={effectiveFocusRequestKey}
							onSelectionChange={setSelection}
							positions={positions}
							selection={selection}
						/>
					</div>
				</div>
			) : (
				<div className="grid h-full place-items-center p-8">
					<div className="flex max-w-md flex-col items-center gap-3 text-center">
						<span
							className={`${
								flowState.status === "error"
									? "icon-[lucide--triangle-alert] text-rose-600"
									: "icon-[lucide--loader-circle] animate-spin text-violet-700"
							} size-9`}
						/>
						<strong>
							{flowState.status === "error" ? "Flow failed" : "Building flow"}
						</strong>
						<span className="text-sm text-muted">{flowState.progress.label}</span>
						{flowState.status === "loading" ? (
							<>
								<div className="h-1.5 w-64 overflow-hidden rounded-full bg-violet-100">
									<div
										className="h-full rounded-full bg-violet-500"
										style={{
											width: `${flowState.progress.percent}%`,
										}}
									/>
								</div>
								<span className="font-mono text-xs text-muted">
									{flowState.progress.percent}%
								</span>
							</>
						) : null}
					</div>
				</div>
			)}
		</section>
	);
};

export const EditorItemFlowSection = ({ itemId }: { readonly itemId: string }) => (
	<div className="h-[calc(100vh-7rem)]">
		<EditorOriginFlowSection
			focusItemId={itemId}
			itemId={itemId}
			mode="item"
		/>
	</div>
);
