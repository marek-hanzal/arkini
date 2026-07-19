import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

import type { GameOwner } from "~/bridge/game/GameOwner";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { Button, PrimaryButton } from "~/ui/button/Button";

export namespace GameRouteReleaseFailure {
	export interface Props {
		readonly owner: GameOwner;
		readonly state: Extract<
			GameOwner.State,
			{
				readonly type: "failed";
			}
		>;
	}
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Keeps a failed route release visible until its exact final-save obligation is resolved. */
export const GameRouteReleaseFailure = ({ owner, state }: GameRouteReleaseFailure.Props) => {
	const navigate = useNavigate();
	const pendingRef = useRef(false);
	const [pending, setPending] = useState(false);
	const [retryError, setRetryError] = useState<unknown>();
	const packageId = state.game?.arkpack.packageId ?? state.packageId;

	const retry = () => {
		if (pendingRef.current) return;
		pendingRef.current = true;
		setPending(true);
		setRetryError(undefined);
		void RendererRuntime.runPromise(owner.releaseRouteGameFx())
			.catch(setRetryError)
			.finally(() => {
				pendingRef.current = false;
				setPending(false);
			});
	};

	const returnToGame = () => {
		if (pendingRef.current || packageId === null) return;
		pendingRef.current = true;
		setPending(true);
		setRetryError(undefined);
		void navigate({
			to: "/game/$packageId",
			params: {
				packageId,
			},
		}).catch((error) => {
			pendingRef.current = false;
			setPending(false);
			setRetryError(error);
		});
	};

	return (
		<div
			className="fixed inset-0 z-[110] flex items-center justify-center bg-overlay/95 p-6 text-center text-sm text-danger"
			data-ui="GameRouteReleaseFailure"
			role="alert"
		>
			<div className="flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-danger/25 bg-surface-raised p-6 shadow-2xl">
				<h2 className="text-lg font-semibold text-danger">Final save failed</h2>
				<p>
					Arkini is still holding the frozen game so the exact same final save can be
					retried. It will not be published as playable until that obligation succeeds.
				</p>
				<p className="text-xs text-muted">{errorMessage(state.error)}</p>
				{retryError === undefined ? null : (
					<p className="text-xs text-danger">Retry failed: {errorMessage(retryError)}</p>
				)}
				<div className="flex flex-wrap justify-center gap-2">
					<PrimaryButton
						disabled={pending}
						onClick={retry}
					>
						{pending ? "Retrying final save…" : "Retry final save"}
					</PrimaryButton>
					{packageId === null ? null : (
						<Button
							disabled={pending}
							onClick={returnToGame}
						>
							Return to game
						</Button>
					)}
				</div>
			</div>
		</div>
	);
};
