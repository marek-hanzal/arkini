import { Effect } from "effect";
import { match } from "ts-pattern";

import type { InputSchema as ImmediateInputSchema } from "~/engine/action/schema/InputSchema";
import type { InputSchema as LineInputSchema } from "~/engine/input/schema/InputSchema";
import type { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";

export interface CreateEditorItemDraftFxProps {
	readonly resourceId: string;
	readonly type: TypeSchema.Type;
	readonly uid: string;
}

/** Creates the canonical starting shape shared by UI, MCP, and type conversions. */
export const createEditorItemDraftFx = Effect.fn("createEditorItemDraftFx")(
	({ resourceId, type, uid }: CreateEditorItemDraftFxProps) =>
		Effect.sync((): ItemSchema.Type => {
			const itemId = type === "producer" ? "producer:new-item" : "item:new-item";
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
					LineInputSchema.Type,
				],
				rules: [],
			} satisfies Omit<LineSchema.Type, "description" | "title">;
			return match(type)
				.with("simple", (matchedType) => ({
					...base,
					type: matchedType,
				}))
				.with("space", (matchedType) => ({
					...base,
					type: matchedType,
					space: 0,
					enable: true,
					input: [] as ImmediateInputSchema.Type[],
					rules: [],
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
						LineSchema.Type,
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
		}),
);
