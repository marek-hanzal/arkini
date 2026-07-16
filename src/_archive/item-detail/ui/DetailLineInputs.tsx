import type { FC } from "react";
import { readActivationInputViewFillableQuantity } from "~/board/view/readActivationInputViewFillableQuantity";
import { readActivationInputViewLabel } from "~/board/view/readActivationInputViewLabel";
import { readActivationInputViewReady } from "~/board/view/readActivationInputViewReady";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import type { DetailLineModel } from "~/item-detail/control/DetailLineModel";
import { readDetailItemName } from "~/item-detail/ui/readDetailItemName";
import { ItemInlineAsset } from "~/item/ui/ItemInlineAsset";
import { UiButton } from "~/ui/UiButton";
import { cn } from "~/ui/cn";
import { joinTextParts } from "~/ui/joinTextParts";

const readProducerInputRowClassName = ({
	available,
	fulfilled,
}: {
	available: boolean;
	fulfilled: boolean;
}) =>
	cn(
		"flex min-w-0 items-center gap-2 rounded-sm border px-2.5 py-2 text-xs transition-[background,border-color,box-shadow]",
		fulfilled
			? "border-emerald-300/30 bg-emerald-400/10 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.07)]"
			: available
				? "border-fuchsia-300/65 bg-fuchsia-400/10 shadow-[inset_0_0_0_1px_rgba(236,72,153,0.07)]"
				: "border-transparent bg-ak-surface/80",
	);

export const DetailLineInputs: FC<{
	items: ItemCatalogView;
	model: DetailLineModel;
}> = ({ items, model }) => {
	const { control, line } = model;
	if (line.inputs.length === 0) return null;

	return (
		<div className="rounded-sm bg-ak-surface/80 px-2.5 py-2 text-xs">
			<p className="font-black text-ak-text">Inputs</p>
			<div className="mt-2 grid gap-2">
				{line.inputs.map((input) => {
					const inputItem = items[input.itemId];
					const fillableQuantity = readActivationInputViewFillableQuantity(input);
					const ready = readActivationInputViewReady(input);
					const withdrawAction = control.withdrawInputActionsByItemId[input.itemId];
					const meta = joinTextParts([
						readActivationInputViewLabel(input),
						fillableQuantity > 0 ? `+${fillableQuantity} available` : undefined,
						input.capacity > input.quantity ? `cap ${input.capacity}` : undefined,
					]);

					return (
						<div
							key={input.itemId}
							className={readProducerInputRowClassName({
								available: fillableQuantity > 0,
								fulfilled: ready,
							})}
						>
							<ItemInlineAsset
								item={inputItem}
								className="h-9 w-9"
							/>
							<div className="min-w-0 flex-1">
								<p className="break-words font-black text-ak-text">
									{inputItem?.name ??
										readDetailItemName({
											itemId: input.itemId,
											items,
										})}
								</p>
								<p
									className={cn(
										"mt-0.5 break-words leading-5",
										ready ? "font-bold text-emerald-700" : "text-ak-text-muted",
									)}
								>
									{meta}
								</p>
							</div>
							{withdrawAction ? (
								<UiButton
									data-ui="withdraw action"
									disabled={withdrawAction.disabled}
									fullWidth={false}
									tone={withdrawAction.tone}
									onClick={withdrawAction.onClick}
								>
									{withdrawAction.label}
								</UiButton>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
};
