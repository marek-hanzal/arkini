import { match } from "ts-pattern";
import {
	applyGrantExtraOutputChanceDropEffect,
	applyNearbyLootChanceDropEffect,
} from "~/effects/applyEffectiveDropChanceEffect";
import {
	applyGrantBlockStartDropEffect,
	applyGrantRequirementDropEffect,
	applyNearbyRequirementDropEffect,
} from "~/effects/applyEffectiveDropRequirementEffect";
import { applyGrantDropToggleEffect } from "~/effects/applyEffectiveDropToggleEffect";
import type {
	EffectiveDropEffectApplicationProps,
	EffectiveDropEvaluation,
} from "~/effects/EffectiveDropEvaluation";

const readUnchangedDropEvaluation = ({
	chanceItems,
	enabled,
	visible,
}: Pick<
	EffectiveDropEffectApplicationProps,
	"chanceItems" | "enabled" | "visible"
>): EffectiveDropEvaluation => ({
	chanceItems: [
		...chanceItems,
	],
	dropEffects: [],
	enabled,
	visible,
});

export const applyEffectiveDropEffect = (
	props: EffectiveDropEffectApplicationProps,
): EffectiveDropEvaluation =>
	match(props.effect)
		.with(
			{
				kind: "grant.require",
			},
			(effect) =>
				applyGrantRequirementDropEffect({
					...props,
					effect,
				}),
		)
		.with(
			{
				kind: "nearby.require",
			},
			(effect) =>
				applyNearbyRequirementDropEffect({
					...props,
					effect,
				}),
		)
		.with(
			{
				kind: "grant.blockStart",
			},
			(effect) =>
				applyGrantBlockStartDropEffect({
					...props,
					effect,
				}),
		)
		.with(
			{
				kind: "grant.drop.hide",
			},
			{
				kind: "grant.drop.show",
			},
			{
				kind: "grant.drop.disable",
			},
			{
				kind: "grant.drop.enable",
			},
			(effect) =>
				applyGrantDropToggleEffect({
					...props,
					effect,
				}),
		)
		.with(
			{
				kind: "nearby.loot.outputChance.add",
			},
			(effect) =>
				applyNearbyLootChanceDropEffect({
					...props,
					effect,
				}),
		)
		.with(
			{
				kind: "grant.loot.extraOutputChance.add",
			},
			(effect) =>
				applyGrantExtraOutputChanceDropEffect({
					...props,
					effect,
				}),
		)
		.with(
			{
				kind: "grant.duration.multiply",
			},
			{
				kind: "nearby.capacity.spend",
			},
			{
				kind: "nearby.duration.multiply",
			},
			() => readUnchangedDropEvaluation(props),
		)
		.exhaustive();
