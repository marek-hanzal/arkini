import { Info } from "lucide-react";

import { ItemInfo } from "~/item-detail/ui/ItemInfo";
import { ItemLineInputs } from "~/item-detail/ui/ItemLineInputs";
import { useItemSimpleDefaultController } from "~/item-detail/ui/useItemSimpleDefaultController";
import type { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { PrimaryButton } from "~/ui/ui/Button";

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
	const actionDisabled = disabled || stale || line === undefined || !detail.defaultLinePlayReady;
	const controller = useItemSimpleDefaultController({
		ownerItemId,
		disabled: actionDisabled,
	});
	return (
		<div
			className="grid min-h-full items-center"
			data-ui="ItemDetailSimple"
		>
			<ItemInfo
				detail={detail}
				stale={stale}
			>
				{line === undefined ? null : (
					<div
						className="grid gap-4"
						data-ui="ItemSimpleDefaultLine"
					>
						<ItemLineInputs
							ownerItemId={ownerItemId}
							line={line}
							idle={false}
							disabled={disabled || stale}
						/>
						<PrimaryButton
							className="w-full"
							disabled={actionDisabled || controller.pending}
							onClick={controller.startFn}
							data-ui="ItemSimpleDefaultAction"
						>
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
