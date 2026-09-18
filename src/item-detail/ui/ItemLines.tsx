import { Factory, ListPlus } from "lucide-react";

import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { useItemLineMakeController } from "~/item-detail/ui/useItemLineMakeController";
import { ItemLineInputs } from "~/item-detail/ui/ItemLineInputs";
import { useTranslator } from "~/translation/ui/useTranslator";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Status } from "~/ui/ui/Status";

interface ItemLineProps extends useItemLineMakeController.Props {
	readonly line: LineSchema.Type;
}

const ItemLine = ({ line, ...props }: ItemLineProps) => {
	const controller = useItemLineMakeController(props);
	const translator = useTranslator();
	return (
		<article
			className="py-5"
			data-ui="ItemLine"
			data-line-id={line.id}
		>
			<div className="flex items-center gap-3">
				<h3 className="min-w-0 text-lg font-semibold">{line.title}</h3>
				<span className="shrink-0 text-muted">· {formatDurationFn(line.runtimeMs)}</span>
				<LinkButton
					className="ml-auto inline-flex shrink-0 items-center gap-2"
					disabled={
						props.disabled || controller.pending || props.ownerItemId === undefined
					}
					onClick={controller.makeFn}
				>
					<ListPlus className="size-5" />
					{translator.textFn("Make")}
				</LinkButton>
			</div>
			{line.description ? (
				<p className="mt-2 whitespace-pre-wrap text-muted">{line.description}</p>
			) : null}
			<ItemLineInputs
				ownerItemId={props.ownerItemId}
				line={line}
			/>
		</article>
	);
};

export const ItemLines = ({
	lines,
	ownerItemId,
	disabled,
}: {
	readonly lines: readonly LineSchema.Type[];
	readonly ownerItemId?: IdSchema.Type;
	readonly disabled: boolean;
}) => {
	const translator = useTranslator();
	if (lines.length === 0)
		return (
			<Status
				icon={Factory}
				title={translator.textFn("This item doesn't make anything.")}
				variant="flat"
				size="large"
			/>
		);
	return (
		<section
			className="divide-y divide-line px-3"
			data-ui="ItemLines"
		>
			{lines.map((line) => (
				<ItemLine
					key={line.id}
					line={line}
					lineId={line.id}
					ownerItemId={ownerItemId}
					disabled={disabled}
				/>
			))}
		</section>
	);
};
