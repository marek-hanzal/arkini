import { motion } from "motion/react";
import { type PropsWithChildren, type ReactNode, useEffect } from "react";
import { match } from "ts-pattern";

import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";
import { readTileDeliveryTiming } from "~/ui/tile/readTileDeliveryTiming";
import { readTileDirectionalImpactResponse } from "~/ui/tile/readTileDirectionalImpactResponse";
import { readTileProducerEmissionResponse } from "~/ui/tile/readTileProducerEmissionResponse";
import { tileProducerEmissionReleaseDelay } from "~/ui/tile/tileProducerEmissionTiming";

export namespace TileMotionCueVisual {
	export type Mode = "play" | "defer" | "discard";

	export interface Props extends PropsWithChildren {
		readonly surfaceId: string;
		readonly live: boolean;
		readonly exiting: boolean;
		readonly cue: TileMotionCueSchema.Type | null;
		readonly mode: Mode;
		readonly originOffset: {
			readonly x: number;
			readonly y: number;
		} | null;
		readonly targetOffset: {
			readonly x: number;
			readonly y: number;
		} | null;
		readonly spawnDeliveryTiming: readTileDeliveryTiming.Result | null;
		readonly spawnDeliveryReady?: boolean;
		readonly deliveryPayload: ReactNode | null;
		readonly preContactPayload?: ReactNode | null;
		readonly morphPayload?: ReactNode | null;
		readonly transferPayload: ReactNode | null;
		readonly onStart: (generation: number) => void;
		readonly onContact?: (generation: number) => void;
		readonly onComplete: (generation: number) => void;
	}
}

/** Owns the autonomous cue transform nested inside the actor interaction visual. */
export const TileMotionCueVisual = ({
	children,
	surfaceId,
	live,
	exiting,
	cue,
	mode,
	originOffset,
	targetOffset,
	spawnDeliveryTiming,
	spawnDeliveryReady = true,
	deliveryPayload,
	preContactPayload = null,
	morphPayload = null,
	transferPayload,
	onStart,
	onContact,
	onComplete,
}: TileMotionCueVisual.Props) => {
	const absorbDeliveryTiming =
		cue?.kind === "absorb" && originOffset !== null && deliveryPayload !== null
			? readTileDeliveryTiming({
					offset: originOffset,
				})
			: null;

	useEffect(() => {
		if (cue === null) return;
		if (mode === "play") {
			onStart(cue.generation);
			return;
		}
		if (mode === "discard") onComplete(cue.generation);
	}, [
		cue,
		mode,
		onComplete,
		onStart,
	]);

	useEffect(() => {
		if (
			cue?.kind !== "absorb" ||
			cue.deliveryContacted === true ||
			mode !== "play" ||
			preContactPayload === null ||
			onContact === undefined ||
			absorbDeliveryTiming !== null
		) {
			return;
		}
		onContact(cue.generation);
	}, [
		absorbDeliveryTiming,
		cue?.deliveryContacted,
		cue?.generation,
		cue?.kind,
		mode,
		onContact,
		preContactPayload,
	]);

	if (cue?.kind === "spawn" && mode !== "play" && !spawnDeliveryReady) {
		return (
			<motion.span
				key={cue.generation}
				className="absolute inset-0"
				data-ui="TileMotionCueVisual"
				data-motion-cue="spawn-hold"
				data-motion-cue-generation={cue.generation}
				data-surface-id={surfaceId}
				data-live={live ? "true" : "false"}
				data-motion-exiting={exiting ? "true" : "false"}
				initial={false}
				animate={{
					scale: 0.74,
					opacity: 0.35,
					y: 10,
				}}
			>
				{children}
			</motion.span>
		);
	}

	if (cue?.kind === "morph" && mode === "defer" && morphPayload !== null) {
		return (
			<span
				className="absolute inset-0"
				data-ui="TileMotionCueVisual"
				data-motion-cue="morph-hold"
				data-motion-cue-generation={cue.generation}
				data-surface-id={surfaceId}
				data-live={live ? "true" : "false"}
				data-motion-exiting={exiting ? "true" : "false"}
			>
				{morphPayload}
			</span>
		);
	}

	if (cue?.kind === "absorb" && mode === "defer" && preContactPayload !== null) {
		return (
			<span
				className="absolute inset-0"
				data-ui="TileMotionCueVisual"
				data-motion-cue="absorb-hold"
				data-motion-cue-generation={cue.generation}
				data-surface-id={surfaceId}
				data-live={live ? "true" : "false"}
				data-motion-exiting={exiting ? "true" : "false"}
			>
				{preContactPayload}
			</span>
		);
	}

	if (cue?.kind === "consume" && mode === "defer" && transferPayload !== null) {
		return (
			<span
				className="absolute inset-0"
				data-ui="TileMotionCueVisual"
				data-motion-cue="consume-hold"
				data-motion-cue-generation={cue.generation}
				data-surface-id={surfaceId}
				data-live={live ? "true" : "false"}
				data-motion-exiting={exiting ? "true" : "false"}
			>
				{transferPayload}
			</span>
		);
	}

	if (cue === null || mode !== "play") {
		return (
			<span
				className="absolute inset-0"
				data-ui="TileMotionCueVisual"
				data-surface-id={surfaceId}
				data-live={live ? "true" : "false"}
				data-motion-exiting={exiting ? "true" : "false"}
			>
				{children}
			</span>
		);
	}

	if (cue.kind === "morph") {
		const duration = morphPayload === null ? 0 : 0.54;
		return (
			<motion.span
				key={cue.generation}
				className="absolute inset-0"
				data-ui="TileMotionCueVisual"
				data-motion-cue={morphPayload === null ? "morph-canonical" : cue.kind}
				data-motion-cue-generation={cue.generation}
				data-motion-cue-strength={cue.strength}
				data-surface-id={surfaceId}
				data-live={live ? "true" : "false"}
				data-motion-exiting={exiting ? "true" : "false"}
				initial={false}
				animate={{
					scale:
						morphPayload === null
							? 1
							: [
									1,
									0.9,
									1.06,
									1,
								],
					opacity: 1,
				}}
				transition={{
					duration,
					ease: [
						0.22,
						1,
						0.36,
						1,
					],
				}}
				onAnimationComplete={() => onComplete(cue.generation)}
			>
				{morphPayload === null ? (
					children
				) : (
					<>
						<motion.span
							className="absolute inset-0"
							data-ui="TileMotionMorphPrevious"
							aria-hidden="true"
							initial={{
								opacity: 1,
								scale: 1,
							}}
							animate={{
								opacity: [
									1,
									1,
									0,
								],
								scale: [
									1,
									0.96,
									1.02,
								],
							}}
							transition={{
								duration,
								times: [
									0,
									0.42,
									0.68,
								],
							}}
						>
							{morphPayload}
						</motion.span>
						<motion.span
							className="absolute inset-0"
							data-ui="TileMotionMorphCurrent"
							initial={{
								opacity: 0,
								scale: 0.94,
							}}
							animate={{
								opacity: [
									0,
									0,
									1,
								],
								scale: [
									0.94,
									0.94,
									1,
								],
							}}
							transition={{
								duration,
								times: [
									0,
									0.42,
									0.68,
								],
							}}
						>
							{children}
						</motion.span>
					</>
				)}
			</motion.span>
		);
	}

	if (cue.kind === "consume" || cue.kind === "consume-exit") {
		const exits = cue.kind === "consume-exit";
		const duration = 0.66;
		const reachX = targetOffset?.x ?? 0;
		const reachY = targetOffset?.y ?? (exits ? -12 : 4);
		const travelX = exits
			? [
					0,
					reachX * 0.72,
					reachX,
				]
			: [
					0,
					reachX * 0.78,
					0,
				];
		const travelY = exits
			? [
					0,
					reachY * 0.72,
					reachY,
				]
			: [
					0,
					reachY * 0.78,
					0,
				];
		return (
			<motion.span
				key={cue.generation}
				className="absolute inset-0"
				data-ui="TileMotionCueVisual"
				data-motion-cue={cue.kind}
				data-motion-cue-generation={cue.generation}
				data-motion-cue-strength={cue.strength}
				data-motion-transfer-contact={!exits && transferPayload !== null ? 0.5 : undefined}
				data-surface-id={surfaceId}
				data-live={live ? "true" : "false"}
				data-motion-exiting={exiting ? "true" : "false"}
				initial={false}
				animate={{
					x: travelX,
					y: travelY,
					scale: exits
						? [
								1,
								0.82,
								0.58,
							]
						: [
								1,
								0.78,
								0.9,
								1,
							],
					opacity: exits
						? [
								1,
								1,
								0,
							]
						: 1,
				}}
				transition={{
					duration,
					times: [
						0,
						0.5,
						1,
					],
					ease: [
						0.22,
						1,
						0.36,
						1,
					],
				}}
				onAnimationComplete={() => onComplete(cue.generation)}
			>
				{transferPayload === null || exits ? (
					children
				) : (
					<>
						<motion.span
							className="absolute inset-0"
							data-ui="TileMotionTransferCurrent"
							initial={false}
							animate={{
								opacity: [
									0,
									0,
									1,
									1,
								],
							}}
							transition={{
								duration,
								times: [
									0,
									0.5,
									0.5,
									1,
								],
							}}
						>
							{children}
						</motion.span>
						<motion.span
							className="absolute inset-0"
							data-ui="TileMotionTransferPrevious"
							initial={false}
							animate={{
								opacity: [
									1,
									1,
									0,
									0,
								],
							}}
							transition={{
								duration,
								times: [
									0,
									0.5,
									0.5,
									1,
								],
							}}
						>
							{transferPayload}
						</motion.span>
					</>
				)}
			</motion.span>
		);
	}

	if (cue.kind === "absorb") {
		const rebound = 1.08 + (cue.strength - 1) * 0.02;
		const deliveryTiming = absorbDeliveryTiming;
		const contactDelay = deliveryTiming?.contactDelay ?? 0;
		const contactDuration = deliveryTiming === null ? 0.6 : 0.36;
		const impactResponse =
			originOffset === null
				? null
				: readTileDirectionalImpactResponse({
						// Cue geometry is target-to-origin; impact response consumes origin-to-target.
						originToTarget: {
							x: -originOffset.x,
							y: -originOffset.y,
						},
					});
		const hasDirectionalImpact = impactResponse !== null && impactResponse.primaryAxis !== null;
		return (
			<span
				key={cue.generation}
				className="absolute inset-0"
				data-ui="TileMotionCueVisual"
				data-motion-cue={cue.kind}
				data-motion-cue-generation={cue.generation}
				data-motion-cue-strength={cue.strength}
				data-surface-id={surfaceId}
				data-live={live ? "true" : "false"}
				data-motion-exiting={exiting ? "true" : "false"}
			>
				<motion.span
					className="absolute inset-0"
					data-ui="TileMotionAbsorbTarget"
					data-motion-contact-delay={contactDelay}
					initial={false}
					animate={{
						...(hasDirectionalImpact
							? {
									scaleX: [
										1,
										impactResponse.scaleX,
										impactResponse.scaleX === 0.9 ? rebound : 1,
										1,
									],
									scaleY: [
										1,
										impactResponse.scaleY,
										impactResponse.scaleY === 0.9 ? rebound : 1,
										1,
									],
									rotate: [
										0,
										impactResponse.rotation,
										-impactResponse.rotation * 0.35,
										0,
									],
								}
							: {
									scale: [
										1,
										0.75,
										rebound,
										1,
									],
								}),
						opacity: 1,
					}}
					transition={{
						delay: contactDelay,
						duration: contactDuration,
						ease: [
							0.22,
							1,
							0.36,
							1,
						],
					}}
					onAnimationComplete={() => onComplete(cue.generation)}
				>
					{preContactPayload ?? children}
				</motion.span>
				{deliveryTiming === null || originOffset === null ? null : (
					<motion.span
						className="pointer-events-none absolute inset-0"
						data-ui="TileMotionDeliveryPayload"
						data-motion-travel-duration={deliveryTiming.travelDuration}
						aria-hidden="true"
						initial={{
							x: originOffset.x,
							y: originOffset.y,
							scale: 0.72,
							opacity: 0.82,
						}}
						animate={{
							x: 0,
							y: 0,
							scale: [
								0.72,
								0.9,
								0.45,
							],
							opacity: [
								0.82,
								1,
								0,
							],
						}}
						transition={{
							duration: deliveryTiming.travelDuration,
							ease: deliveryTiming.ease,
						}}
						onAnimationComplete={() => {
							if (preContactPayload !== null) onContact?.(cue.generation);
						}}
					>
						{deliveryPayload}
					</motion.span>
				)}
			</span>
		);
	}

	if (cue.kind === "complete" && cue.producerEmissionId !== undefined) {
		const response = readTileProducerEmissionResponse({
			originToTarget: targetOffset ?? {
				x: 0,
				y: 0,
			},
		});
		const duration = 0.6;
		const releaseTime = tileProducerEmissionReleaseDelay / duration;
		return (
			<motion.span
				key={cue.generation}
				className="absolute inset-0"
				data-ui="TileMotionCueVisual"
				data-motion-cue={cue.kind}
				data-motion-cue-generation={cue.generation}
				data-motion-cue-strength={cue.strength}
				data-motion-emission-direction={`${response.direction.x},${response.direction.y}`}
				data-motion-emission-release-delay={tileProducerEmissionReleaseDelay}
				data-motion-emission-duration={duration}
				data-surface-id={surfaceId}
				data-live={live ? "true" : "false"}
				data-motion-exiting={exiting ? "true" : "false"}
				initial={false}
				animate={{
					scaleX: [
						1,
						response.anticipation.scaleX,
						response.anticipation.scaleX,
						1.03,
						1,
					],
					scaleY: [
						1,
						response.anticipation.scaleY,
						response.anticipation.scaleY,
						1.03,
						1,
					],
					x: [
						0,
						0,
						response.recoil.x,
						response.hop.x,
						0,
					],
					y: [
						0,
						0,
						response.recoil.y,
						response.hop.y,
						0,
					],
					opacity: 1,
				}}
				transition={{
					duration,
					times: [
						0,
						releaseTime * 0.55,
						releaseTime,
						0.68,
						1,
					],
					ease: [
						0.22,
						1,
						0.36,
						1,
					],
				}}
				onAnimationComplete={() => onComplete(cue.generation)}
			>
				{children}
			</motion.span>
		);
	}

	const animation = match(cue.kind)
		.with("spawn", () => ({
			initial: {
				scale: 0.74,
				opacity: 0.35,
				y: 10,
			},
			animate: {
				scale: [
					0.74,
					1.09,
					1,
				],
				opacity: [
					0.35,
					1,
					1,
				],
				y: [
					10,
					-3,
					0,
				],
			},
			duration: spawnDeliveryTiming === null ? 0.6 : 0.36,
		}))
		.with("settle", () => ({
			initial: {
				scale: 0.92,
				opacity: 0.66,
				y: 6,
			},
			animate: {
				scale: 1,
				opacity: 1,
				y: 0,
			},
			duration: 0.4,
		}))
		.with("impact", () => {
			const peak = 1.12 + (cue.strength - 1) * 0.03;
			return {
				initial: false as const,
				animate: {
					scale: [
						1,
						peak,
						1,
					],
					opacity: 1,
					y: [
						0,
						-3 - cue.strength,
						0,
					],
				},
				duration: 0.45,
			};
		})
		.with("accept", () => ({
			initial: false as const,
			animate: {
				scale: [
					1,
					0.75,
					1.04,
					1,
				],
				opacity: 1,
				y: [
					0,
					3,
					-2,
					0,
				],
			},
			duration: 0.58,
		}))
		.with("complete", () => {
			const release = 1.1 + (cue.strength - 1) * 0.02;
			return {
				initial: false as const,
				animate: {
					scale: [
						1,
						0.88,
						release,
						1,
					],
					opacity: 1,
					y: [
						0,
						2,
						-4,
						0,
					],
				},
				duration: 0.68,
			};
		})
		.with("charge", () => ({
			initial: false as const,
			animate: {
				scaleX: [
					1,
					0.95,
					0.99,
					1,
				],
				scaleY: [
					1,
					0.89,
					0.98,
					1,
				],
				opacity: 1,
				rotate: [
					0,
					-1.8,
					0.8,
					0,
				],
			},
			duration: 0.3,
		}))
		.with("pause", () => ({
			initial: false as const,
			animate: {
				scale: [
					1,
					0.94,
					1,
				],
				opacity: [
					1,
					0.82,
					1,
				],
				y: 0,
			},
			duration: 0.3,
		}))
		.with("resume", () => ({
			initial: false as const,
			animate: {
				scale: [
					1,
					1.05,
					1,
				],
				opacity: [
					0.88,
					1,
					1,
				],
				y: 0,
			},
			duration: 0.32,
		}))
		.with("deplete", () => ({
			initial: false as const,
			animate: {
				scale: [
					1,
					0.9,
					0.98,
					1,
				],
				opacity: 1,
				y: [
					0,
					2,
					0,
				],
				rotate: [
					0,
					-1.5,
					1,
					0,
				],
			},
			duration: 0.38,
		}))
		.with("deplete-exit", () => ({
			initial: false as const,
			animate: {
				scale: [
					1,
					0.96,
					0.54,
				],
				scaleY: [
					1,
					0.84,
					0.22,
				],
				opacity: [
					1,
					1,
					0,
				],
				y: [
					0,
					5,
					20,
				],
			},
			duration: 0.62,
		}))
		.with("expiry", () => ({
			initial: false as const,
			animate: {
				scale: [
					1,
					0.97,
					0.78,
				],
				opacity: [
					1,
					0.78,
					0,
				],
				y: [
					0,
					-7,
					-26,
				],
			},
			duration: 0.72,
		}))
		.with("exit", () => ({
			initial: false as const,
			animate: {
				scale: [
					1,
					0.96,
					0.68,
				],
				opacity: [
					1,
					1,
					0,
				],
				y: 0,
			},
			duration: 0.46,
		}))
		.exhaustive();

	return (
		<motion.span
			key={cue.generation}
			className="absolute inset-0"
			data-ui="TileMotionCueVisual"
			data-motion-cue={cue.kind}
			data-motion-cue-generation={cue.generation}
			data-motion-cue-strength={cue.strength}
			data-motion-contact-delay={cue.kind === "spawn" ? 0 : undefined}
			data-surface-id={surfaceId}
			data-live={live ? "true" : "false"}
			data-motion-exiting={exiting ? "true" : "false"}
			initial={animation.initial}
			animate={animation.animate}
			transition={{
				delay: 0,
				duration: animation.duration,
				ease: [
					0.22,
					1,
					0.36,
					1,
				],
			}}
			onAnimationComplete={() => onComplete(cue.generation)}
		>
			{children}
		</motion.span>
	);
};
