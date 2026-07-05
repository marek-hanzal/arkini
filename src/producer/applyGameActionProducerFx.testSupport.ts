import { Effect } from "effect";
import { GameSaveConfigSchema } from "~/engine/model/GameSaveSchema";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { runGameTickFx } from "~/engine/runGameTickFx";
import { TestRandomService } from "~/engine/test/TestRandomService";
import { withRandomService } from "~/random/withRandomService";

export {
	findBoardItem,
	readOnlyRecordValue,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/engine/applyGameActionFx.testSupport";
export { createEngineTestConfig, GameSaveConfigSchema };

export const runTick = (props: runGameTickFx.Props) =>
	Effect.runSync(runGameTickFx(props).pipe(withRandomService(TestRandomService)));

export type TestConfig = ReturnType<typeof createEngineTestConfig>;
export type TestLine = TestConfig["lineCatalog"][string];
export type TestOutputEntry = NonNullable<TestLine["output"]>[number];
export type TestOutputEffect = NonNullable<
	Exclude<
		TestOutputEntry,
		{
			type: "weighted";
		}
	>["effects"]
>[number];

export const appendFirstOutputEffects = (
	line: TestLine | undefined,
	effects: readonly TestOutputEffect[],
): TestLine => {
	if (!line) throw new Error("Missing test line.");
	const [firstOutput, ...remainingOutput] = line.output ?? [
		{
			itemId: "item:plank",
			quantity: 1,
			type: "guaranteed" as const,
		},
	];
	if (firstOutput.type === "weighted") {
		throw new Error("Test helper only supports non-weighted first outputs.");
	}

	return {
		...line,
		output: [
			{
				...firstOutput,
				effects: [
					...(firstOutput.effects ?? []),
					...effects,
				],
			},
			...remainingOutput,
		],
	};
};

export const readOwnedTwigGrantConfig = (
	baseConfig: ReturnType<typeof createEngineTestConfig>,
	lineIds: readonly string[],
) => {
	const grantId = "grant:test:owned-twig";
	const effectId = "effect:test:owned-twig-grant";
	return {
		itemEffects: {
			"item:twig": [
				{
					id: effectId,
					polarity: "neutral" as const,
					grants: [
						{
							id: grantId,
							name: "Test grant",
						},
					],
					name: "Owned Twig Grant",
					sourceScope: "both" as const,
				},
			],
		},
		lineOverrides: {
			...Object.fromEntries(
				lineIds.map((lineId) => [
					lineId,
					appendFirstOutputEffects(baseConfig.lineCatalog[lineId], [
						{
							display: "always" as const,
							kind: "grant.require" as const,
							phase: "start" as const,
							selector: {
								allOf: [
									{
										ids: [
											grantId,
										],
									},
								],
							},
						},
					]),
				]),
			),
		},
	};
};

export const readLocalTwigGrantConfig = (
	baseConfig: ReturnType<typeof createEngineTestConfig>,
	props: {
		lineIds: readonly string[];
		radius: number;
	},
) => ({
	lineOverrides: {
		...Object.fromEntries(
			props.lineIds.map((lineId) => [
				lineId,
				appendFirstOutputEffects(baseConfig.lineCatalog[lineId], [
					{
						display: "always" as const,
						items: {
							anyOf: [
								{
									ids: [
										"item:twig",
									],
								},
							],
						},
						kind: "nearby.require" as const,
						phase: "start" as const,
						radius: props.radius,
					},
				]),
			]),
		),
	},
});
