import { Info, Play } from "lucide-react";

import { ItemInfo } from "~/item-detail/ui/ItemInfo";
import { ItemLineInputs } from "~/item-detail/ui/ItemLineInputs";
import { useItemSimpleDefaultController } from "~/item-detail/ui/useItemSimpleDefaultController";
import type { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { PrimaryButton } from "~/ui/ui/Button";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

interface ItemDetailSimpleProps {
	readonly detail: useItemDetailSceneController.Detail;
	readonly disabled: boolean;
	readonly ownerItemId?: IdSchema.Type;
	readonly stale: boolean;
}

/** Compact item facts and direct control of its effective Default recipe. */
export const ItemDetailSimple = ({
	detail,
	disabled,
	ownerItemId,
	stale,
}: ItemDetailSimpleProps) => {
	const line = detail.defaultLine;
	const controller = useItemSimpleDefaultController({
		ownerItemId,
		disabled: disabled || stale || line === undefined,
		ready: detail.defaultLinePlayReady,
	});
	const actionDisabled =
		disabled || stale || line === undefined || !controller.displayReady || controller.pending;
	return (
		<div
			className="grid min-h-full items-center"
			data-ui="ItemDetailSimple"
		>
			<ItemInfo
				detail={detail}
				stale={stale}
				requirements={
					!stale &&
					line?.input.some(
						(input) =>
							input.type === "materials" ||
							(input.type === "units" && input.query.distance !== "self"),
					) ? (
						<ItemLineInputs
							ownerItemId={ownerItemId}
							line={line}
							idle={false}
							disabled={disabled || stale}
						/>
					) : undefined
				}
			>
				{stale || line === undefined ? null : (
					<div
						className="grid gap-4"
						data-ui="ItemSimpleDefaultLine"
					>
						<PrimaryButton
							className="min-h-20 w-3/4 justify-self-center gap-3 disabled:opacity-100 data-[ui-display-ready=false]:opacity-60"
							disabled={actionDisabled}
							onClick={controller.startFn}
							{...readDataUiFn({
								dataUi: "ItemSimpleDefaultAction",
								state: {
									displayReady: controller.displayReady,
								},
							})}
						>
							<Play
								className="size-6 shrink-0"
								fill="currentColor"
							/>
							{line.title}
						</PrimaryButton>
						{detail.defaultLineDisabled &&
						detail.defaultLineBlockingHint !== undefined ? (
							<p
								className="flex items-center gap-3 rounded-xl bg-surface/90 px-4 py-3 text-base leading-relaxed font-semibold text-accent"
								data-ui="ItemSimpleDefaultBlockingHint"
							>
								<Info className="size-6 shrink-0" />
								<span className="whitespace-pre-wrap">
									{detail.defaultLineBlockingHint}
								</span>
							</p>
						) : null}
					</div>
				)}
			</ItemInfo>
		</div>
	);
};
