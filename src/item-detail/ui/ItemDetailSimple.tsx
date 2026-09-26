import { Info, ListX, Play } from "lucide-react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useEffect, useState } from "react";

import { ItemInfo } from "~/item-detail/ui/ItemInfo";
import { ItemLineInputs } from "~/item-detail/ui/ItemLineInputs";
import { useItemLineWorkController } from "~/item-detail/ui/useItemLineWorkController";
import { useItemLinesStatus } from "~/item-detail/ui/useItemLinesStatus";
import { useItemSimpleDefaultController } from "~/item-detail/ui/useItemSimpleDefaultController";
import type { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButton } from "~/ui/ui/LinkButton";
import { PrimaryButton } from "~/ui/ui/Button";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Tooltip } from "~/ui/ui/Tooltip";

interface ItemDetailSimpleProps {
	readonly detail: useItemDetailSceneController.Detail;
	readonly disabled: boolean;
	readonly ownerItemId?: IdSchema.Type;
	readonly stale: boolean;
}

const ItemSimplePendingCancel = ({
	clearFn,
	disabled,
}: {
	readonly clearFn: () => void;
	readonly disabled: boolean;
}) => {
	const present = useIsPresent();
	const translator = useTranslator();
	return (
		<motion.div
			className="w-max"
			initial={{
				opacity: 0,
				x: 12,
			}}
			animate={{
				opacity: 1,
				x: 0,
			}}
			exit={{
				opacity: 0,
				x: 12,
			}}
			transition={{
				duration: 0.2,
			}}
			inert={!present}
		>
			<Tooltip
				content={translator.textFn(
					"Cancel the planned batches of this recipe. Anything already cooking keeps going.",
				)}
			>
				<LinkButton
					className="flex min-h-8 items-center gap-1.5 text-sm text-foreground/65 decoration-foreground/50 hover:text-foreground disabled:hover:text-foreground/65"
					disabled={disabled || !present}
					onClick={clearFn}
					data-ui="ItemSimplePendingCancel"
				>
					<ListX className="size-4 shrink-0" />
					{translator.textFn("Cancel")}
				</LinkButton>
			</Tooltip>
		</motion.div>
	);
};

const ItemSimpleQueueCancel = ({
	ownerItemId,
	lineUid,
	disabled,
	hasPendingWork,
}: {
	readonly ownerItemId?: IdSchema.Type;
	readonly lineUid: IdSchema.Type;
	readonly disabled: boolean;
	readonly hasPendingWork: boolean;
}) => {
	const key = `${ownerItemId}:${lineUid}`;
	const [visibleKey, setVisibleKeyFn] = useState<string>();
	useEffect(() => {
		if (!hasPendingWork) {
			setVisibleKeyFn(undefined);
			return;
		}
		const timeout = setTimeout(() => setVisibleKeyFn(key), 400);
		return () => clearTimeout(timeout);
	}, [
		key,
		hasPendingWork,
	]);
	const controller = useItemLineWorkController({
		ownerItemId,
		lineUid,
		disabled,
	});
	return (
		<AnimatePresence>
			{hasPendingWork && visibleKey === key ? (
				<ItemSimplePendingCancel
					key={key}
					clearFn={controller.clearFn}
					disabled={controller.clearDisabled}
				/>
			) : null}
		</AnimatePresence>
	);
};

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
		lineUid: line?.uid,
		disabled: disabled || stale || line === undefined,
		ready: detail.defaultLinePlayReady,
		autofillCovered: detail.defaultLineAutofillCovered,
	});
	const statuses = useItemLinesStatus(ownerItemId);
	const hasPendingWork = statuses.some(
		(status) => status.lineUid === line?.uid && status.queued > 0,
	);
	const actionDisabled =
		disabled ||
		stale ||
		line === undefined ||
		!detail.defaultLinePlayReady ||
		!controller.displayReady ||
		controller.pending;
	const visualReady = controller.displayReady && !disabled && !stale;
	const hasRequirements = line?.input.some(
		(input) =>
			input.type === "materials" ||
			(input.type === "units" && input.query.distance !== "self"),
	);
	const cancel =
		line === undefined ? null : (
			<ItemSimpleQueueCancel
				ownerItemId={ownerItemId}
				lineUid={line.uid}
				disabled={disabled}
				hasPendingWork={hasPendingWork}
			/>
		);
	return (
		<div
			className="grid min-h-full items-center"
			data-ui="ItemDetailSimple"
		>
			<ItemInfo
				detail={detail}
				stale={stale}
			>
				{stale || line === undefined ? null : (
					<div
						className="grid gap-4"
						data-ui="ItemSimpleDefaultLine"
					>
						<div
							className="relative pb-9 data-[ui-has-requirements=false]:mx-auto data-[ui-has-requirements=false]:w-3/4 data-[ui-has-requirements=false]:max-w-sm"
							{...readDataUiFn({
								dataUi: "ItemSimpleDefaultControlGroup",
								state: {
									hasRequirements: Boolean(hasRequirements),
								},
							})}
						>
							{hasRequirements ? (
								<div
									className="grid min-h-20 grid-cols-2 items-center gap-4 rounded-2xl bg-selection/75 px-2 py-3 backdrop-blur-md"
									data-ui="ItemSimpleDefaultControls"
								>
									<ItemLineInputs
										ownerItemId={ownerItemId}
										line={line}
										idle={false}
										compact
										disabled={disabled || stale}
									/>
									<LinkButton
										className="flex min-h-16 w-fit max-w-full min-w-0 items-center justify-self-end gap-2 px-2 py-1 text-left text-lg leading-tight font-semibold disabled:hover:text-muted data-[ui-visual-ready=true]:disabled:text-accent data-[ui-visual-ready=true]:disabled:hover:text-accent"
										disabled={actionDisabled}
										onClick={controller.startFn}
										{...readDataUiFn({
											dataUi: "ItemSimpleDefaultAction",
											state: {
												visualReady,
											},
										})}
									>
										<Play className="size-5 shrink-0 fill-current" />
										<span>{line.title}</span>
									</LinkButton>
								</div>
							) : (
								<PrimaryButton
									className="flex min-h-14 w-full gap-2 px-4 py-2 text-xl leading-tight data-[ui-visual-ready=true]:disabled:opacity-100"
									disabled={actionDisabled}
									onClick={controller.startFn}
									{...readDataUiFn({
										dataUi: "ItemSimpleDefaultAction",
										state: {
											visualReady,
										},
									})}
								>
									<Play className="size-6 shrink-0 fill-current" />
									<span className="min-w-0 text-center whitespace-normal">
										{line.title}
									</span>
								</PrimaryButton>
							)}
							<div className="absolute right-3 bottom-0">{cancel}</div>
						</div>
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
