import { z } from "zod";

import type { InputSchema } from "~/production-action/schema/InputSchema";
import type { RuleSchema } from "~/production-action/schema/RuleSchema";
import type { BaseSchema } from "~/item-definition/schema/BaseSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";

/** Local presentation values owned only by one mounted item form. */
export type FormValues = Omit<BaseSchema.Type, "asset" | "merge"> & {
	readonly asset: {
		readonly default: [
			string,
			string,
		];
		readonly sources: string[];
	};
	readonly type: TypeSchema.Type;
	readonly durationMs?: number;
	readonly enable?: boolean;
	readonly input?: InputSchema.Type[];
	readonly line?: LineSchema.Type;
	readonly lines?: LineSchema.Type[];
	readonly maxQueueSize?: number;
	readonly merge?: MergeSchema.Type[];
	readonly output?: OutputSchema.Type;
	readonly rules?: RuleSchema.Type[];
	readonly space?: number;
};

/** Removes empty optional artwork slots from the local form representation. */
export const readCanonicalItemArtworkFn = (
	asset: FormValues["asset"],
): ItemSchema.Type["asset"] => {
	const overlay = asset.default[1];
	const sources = asset.sources.filter((resourceId) => resourceId !== "");
	return {
		default:
			overlay === ""
				? [
						asset.default[0],
					]
				: [
						asset.default[0],
						overlay,
					],
		...(sources.length === 0
			? {}
			: {
					sources,
				}),
	};
};

/** Keeps the schema-required query deterministic while Self intentionally hides target controls. */
const bindSelfPaidInputsToOwnerFn = <Inputs extends ReadonlyArray<LineInputSchema.Type>>(
	inputs: Inputs,
	ownerItemId: string,
): Inputs =>
	inputs.map((input) =>
		input.type === "deposit" && input.charges?.from === "self"
			? {
					...input,
					query: {
						scope: "board" as const,
						distance: "self" as const,
						selector: {
							type: "item" as const,
							itemId: ownerItemId,
						},
					},
				}
			: input,
	) as unknown as Inputs;

const bindSelfPaidDepositsToOwnerFn = (candidate: FormValues): FormValues => ({
	...candidate,
	...(candidate.input === undefined
		? {}
		: {
				input: bindSelfPaidInputsToOwnerFn(candidate.input, candidate.id),
			}),
	...(candidate.line === undefined
		? {}
		: {
				line: {
					...candidate.line,
					input: bindSelfPaidInputsToOwnerFn(candidate.line.input, candidate.id),
				},
			}),
	...(candidate.lines === undefined
		? {}
		: {
				lines: candidate.lines.map((line) => ({
					...line,
					input: bindSelfPaidInputsToOwnerFn(line.input, candidate.id),
				})),
			}),
});

/**
 * Validates the local item-form representation and emits one canonical item.
 *
 * Blank required numbers remain `NaN`, so the canonical ItemSchema reports them
 * at their exact field path instead of silently coercing them to zero.
 */
export const FormSchema = z.custom<FormValues>().transform((candidate, context) => {
	const normalized = bindSelfPaidDepositsToOwnerFn(candidate);
	const result = ItemSchema.safeParse({
		...normalized,
		asset: readCanonicalItemArtworkFn(normalized.asset),
	});
	if (result.success) return result.data;
	for (const issue of result.error.issues) {
		context.addIssue({
			...issue,
			path: [
				...issue.path,
			],
		});
	}
	return z.NEVER;
});

export type FormSchema = typeof FormSchema;
