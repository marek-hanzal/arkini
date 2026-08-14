import { Data, type Effect } from "effect";

export const PlannerBudgetCounter = {
	engineTransitions: "engine-transitions",
	strategyInvocations: "strategy-invocations",
} as const;

export type PlannerBudgetCounter = (typeof PlannerBudgetCounter)[keyof typeof PlannerBudgetCounter];

export interface PlannerBudgetLimits {
	readonly maximumDelegationDepth: number;
	readonly maximumEngineTransitions: number;
	readonly maximumStrategyInvocations: number;
}

export const DefaultPlannerBudgetLimits: PlannerBudgetLimits = {
	maximumDelegationDepth: 64,
	maximumEngineTransitions: 100_000,
	maximumStrategyInvocations: 10_000,
};

export interface PlannerBudgetSnapshot {
	readonly engineTransitions: number;
	readonly strategyInvocations: number;
}

export class PlannerBudgetExceeded extends Data.TaggedError("PlannerBudgetExceeded")<{
	readonly attempted: number;
	readonly counter: PlannerBudgetCounter | "delegation-depth";
	readonly limit: number;
}> {}

export interface PlannerBudgetFxService {
	readonly assertDelegationDepthFx: (depth: number) => Effect.Effect<void, PlannerBudgetExceeded>;
	readonly consumeFx: (
		counter: PlannerBudgetCounter,
		amount?: number,
	) => Effect.Effect<PlannerBudgetSnapshot, PlannerBudgetExceeded>;
	readonly limits: PlannerBudgetLimits;
	readonly read: Effect.Effect<PlannerBudgetSnapshot>;
}
