import type { FC } from "react";
import { match } from "ts-pattern";

import type { MergeSchema } from "~/v1/merge/schema/MergeSchema";
import { CodePill } from "./DetailPrimitives";
import { OutputDetails } from "./OutputDetails";
import { SelectorDetails } from "./SchemaValueDetails";

export namespace MergeDetails {
	export interface Props {
		merge: MergeSchema.Type;
		index: number;
	}
}

export const MergeDetails: FC<MergeDetails.Props> = ({ merge, index }) => {
	const targetEffect = match(merge)
		.with(
			{
				effect: "keep",
			},
			() => <CodePill tone="emerald">keep target</CodePill>,
		)
		.with(
			{
				effect: "remove",
			},
			() => <CodePill tone="rose">remove target</CodePill>,
		)
		.with(
			{
				effect: "replace",
			},
			({ result }) => (
				<span className="inline-flex flex-wrap items-center gap-2">
					<CodePill tone="violet">replace target</CodePill>
					<CodePill>{result}</CodePill>
				</span>
			),
		)
		.exhaustive();

	return (
		<article className="rounded-xl border border-slate-800 bg-slate-900/35 p-4">
			<p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
				Merge {index + 1}
			</p>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<SelectorDetails selector={merge.target} />
				<CodePill tone={merge.action === "consume" ? "rose" : "emerald"}>
					source {merge.action}
				</CodePill>
				{targetEffect}
			</div>
			{merge.output ? (
				<div className="mt-4">
					<p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
						Extra output
					</p>
					<OutputDetails output={merge.output} />
				</div>
			) : null}
		</article>
	);
};
