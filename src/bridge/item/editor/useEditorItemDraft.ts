import { useMemo } from "react";
import { match } from "ts-pattern";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type {
	EditorInput,
	EditorItem,
	EditorItemType,
	EditorLine,
} from "~/bridge/item/editor/EditorItemModel";

/** Creates one stable local create-form item for a preallocated immutable UID. */
export const useEditorItemDraft = (type: EditorItemType, uid: string): EditorItem => {
	const project = useEditorProject();
	return useMemo(() => {
		const itemId = type === "producer" ? "producer:new-item" : "item:new-item";
		const resourceId = project.resources[0]?.id ?? "missing-asset";
		const base = {
			uid,
			id: itemId,
			title: "",
			description: "",
			asset: {
				default: [
					resourceId,
				] as [
					string,
				],
			},
			tags: [],
			scope: "any" as const,
			maxStackSize: 1,
		};
		const lineBase = {
			id: `line:${itemId.replace(/^(?:item|producer):/, "") || "new-item"}:default`,
			default: true,
			show: true,
			enable: true,
			runtimeMs: 0,
			input: [
				{
					type: "simple",
				},
			] as [
				EditorInput,
			],
			rules: [],
		} satisfies Omit<EditorLine, "description" | "title">;
		return match(type)
			.with("simple", (matchedType) => ({
				...base,
				type: matchedType,
			}))
			.with("inventory", (matchedType) => ({
				...base,
				type: matchedType,
				scope: "board" as const,
				maxCount: 1,
				maxStackSize: 1,
			}))
			.with("temporary", (matchedType) => ({
				...base,
				type: matchedType,
				scope: "board" as const,
				maxStackSize: 1,
				durationMs: 500,
			}))
			.with("deposit", (matchedType) => ({
				...base,
				type: matchedType,
				maxQueueSize: 1,
			}))
			.with("producer", (matchedType) => ({
				...base,
				type: matchedType,
				maxQueueSize: 1,
				lines: [
					{
						...lineBase,
						title: `New ${matchedType} line`,
						description: `Describe what this ${matchedType} line consumes and produces.`,
					},
				] as [
					EditorLine,
				],
			}))
			.with("blueprint", "craft", "stash", (lineType) => ({
				...base,
				type: lineType,
				line: {
					...lineBase,
					title: `New ${lineType} line`,
					description: `Describe what this ${lineType} line consumes and produces.`,
				},
			}))
			.exhaustive();
	}, [
		project.resources,
		type,
		uid,
	]);
};
