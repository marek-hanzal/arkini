import type { FC } from "react";
import { match } from "ts-pattern";

import type { QuerySchema } from "~/v1/query/schema/QuerySchema";
import type { QuantitySchema } from "~/v1/quantity/schema/QuantitySchema";
import type { SelectorSchema } from "~/v1/selector/schema/SelectorSchema";
import type { WhenSchema } from "~/v1/when/schema/WhenSchema";
import { CodePill } from "./DetailPrimitives";

export namespace QuantityDetails {
	export interface Props {
		quantity: QuantitySchema.Type;
	}
}

export const QuantityDetails: FC<QuantityDetails.Props> = ({ quantity }) =>
	match(quantity)
		.with(
			{
				type: "value",
			},
			({ value }) => <CodePill tone="emerald">× {value}</CodePill>,
		)
		.with(
			{
				type: "range",
			},
			({ min, max }) => (
				<CodePill tone="emerald">
					× {min}–{max}
				</CodePill>
			),
		)
		.exhaustive();

export namespace SelectorDetails {
	export interface Props {
		selector: SelectorSchema.Type;
	}
}

export const SelectorDetails: FC<SelectorDetails.Props> = ({ selector }) =>
	match(selector)
		.with(
			{
				type: "item",
			},
			({ itemId }) => <CodePill tone="violet">item {itemId}</CodePill>,
		)
		.with(
			{
				type: "tag",
			},
			({ tag }) => <CodePill tone="amber">tag {tag}</CodePill>,
		)
		.exhaustive();

export namespace QueryDetails {
	export interface Props {
		query: QuerySchema.Type;
	}
}

export const QueryDetails: FC<QueryDetails.Props> = ({ query }) =>
	match(query)
		.with(
			{
				scope: "board",
			},
			({ distance, selector }) => (
				<span className="inline-flex flex-wrap items-center gap-2">
					<CodePill>board · {distance}</CodePill>
					<SelectorDetails selector={selector} />
				</span>
			),
		)
		.with(
			{
				scope: "inventory",
			},
			({ selector }) => (
				<span className="inline-flex flex-wrap items-center gap-2">
					<CodePill>inventory</CodePill>
					<SelectorDetails selector={selector} />
				</span>
			),
		)
		.with(
			{
				scope: "any",
			},
			({ selector }) => (
				<span className="inline-flex flex-wrap items-center gap-2">
					<CodePill>board + inventory</CodePill>
					<SelectorDetails selector={selector} />
				</span>
			),
		)
		.exhaustive();

export namespace WhenDetails {
	export interface Props {
		when: WhenSchema.Type;
	}
}

export const WhenDetails: FC<WhenDetails.Props> = ({ when }) => {
	const comparison = match(when)
		.with(
			{
				type: "exists",
			},
			() => <CodePill tone="emerald">exists</CodePill>,
		)
		.with(
			{
				type: "count",
			},
			({ count }) => <CodePill tone="emerald">count = {count}</CodePill>,
		)
		.with(
			{
				type: "range",
			},
			({ min, max }) => (
				<CodePill tone="emerald">
					count {min}–{max}
				</CodePill>
			),
		)
		.exhaustive();

	return (
		<div className="flex flex-wrap items-center gap-2">
			{comparison}
			<QueryDetails query={when.query} />
		</div>
	);
};
