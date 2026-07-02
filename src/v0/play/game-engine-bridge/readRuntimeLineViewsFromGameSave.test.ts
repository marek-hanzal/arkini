import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { findBoardItem, runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";
import { readRuntimeLineViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeLineViewsFromGameSave";

const allOfGrant = (grantId: string) => ({
	allOf: [
		{
			ids: [
				grantId,
			],
		},
	],
});

const anyOfItem = (itemId: string) => ({
	anyOf: [
		{
			ids: [
				itemId,
			],
		},
	],
});

type TestConfig = ReturnType<typeof createEngineTestConfig>;
type TestLine = TestConfig["lineCatalog"][string];
type TestOutputEntry = NonNullable<TestLine["output"]>[number];
type TestOutputEffect = NonNullable<
	Exclude<
		TestOutputEntry,
		{
			type: "weighted";
		}
	>["effects"]
>[number];

const appendFirstOutputEffects = (
	line: TestLine | undefined,
	effects: readonly TestOutputEffect[],
): TestLine => {
	if (!line) throw new Error("Missing test line.");
	const [firstOutput, ...remainingOutput] = line.output ?? [
		{
			itemId: "item:twig",
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

const readTestLine = ({
	config,
	nowMs = 0,
	save,
}: {
	config: ReturnType<typeof createEngineTestConfig>;
	nowMs?: number;
	save: ReturnType<typeof runInitialSave>;
}) => {
	const producerItem = findBoardItem(save, {
		itemId: "item:producer",
		x: 0,
		y: 0,
	});
	if (!producerItem) throw new Error("Missing test producer.");

	const [line] = readRuntimeLineViewsFromGameSave({
		config,
		maxQueueSize: 1,
		producerDefinition: config.items["item:producer"].producer!,
		nowMs,
		lineIds: [
			"line:test",
		],
		save,
		targetItemInstanceId: producerItem.id,
	});
	if (!line) throw new Error("Missing test line view.");
	return line;
};

describe("readRuntimeLineViewsFromGameSave", () => {
	it("keeps hidden missing output requirements disabling the affected output", () => {
		const config = createEngineTestConfig({
			effects: {
				"effect:test:missing": {
					polarity: "neutral",
					grants: [
						{
							id: "grant:test:missing",
							name: "Missing",
						},
					],
					name: "Missing Grant",
				},
			},
			lineOverrides: {
				"line:test": appendFirstOutputEffects(
					createEngineTestConfig().lineCatalog["line:test"],
					[
						{
							display: "never",
							kind: "grant.require",
							label: "Hidden Missing Grant",
							phase: "start",
							selector: allOfGrant("grant:test:missing"),
						},
					],
				),
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readTestLine({
			config,
			save,
		});

		expect(line.effectRequirements).toBeUndefined();
		expect(line.startRequirementsReady).toBeUndefined();
		expect(line.outputs).toMatchObject([
			{
				enabled: false,
				itemId: "item:twig",
			},
		]);
	});

	it("keeps hidden lines visible while a runtime job still exists", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:test:path": {
					polarity: "neutral",
					grants: [
						{
							id: "grant:test:path",
							name: "Chosen Path",
						},
					],
					name: "Chosen Path",
				},
			},
			lineOverrides: {
				"line:test": appendFirstOutputEffects(baseConfig.lineCatalog["line:test"], [
					{
						display: "whenMissing",
						kind: "grant.require",
						label: "Chosen path",
						phase: "visibility",
						selector: allOfGrant("grant:test:path"),
					},
				]),
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const producerItem = findBoardItem(save, {
			itemId: "item:producer",
			x: 0,
			y: 0,
		});
		if (!producerItem) throw new Error("Missing test producer.");
		save.producerJobs["job:hidden-line"] = {
			id: "job:hidden-line",
			itemInstanceId: producerItem.id,
			lineId: "line:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};

		const lines = readRuntimeLineViewsFromGameSave({
			config,
			maxQueueSize: 1,
			producerDefinition: config.items["item:producer"].producer!,
			nowMs: 500,
			lineIds: [
				"line:test",
			],
			save,
			targetItemInstanceId: producerItem.id,
		});

		expect(lines).toMatchObject([
			{
				effectRequirements: undefined,
				inProgress: true,
				outputs: [],
				lineId: "line:test",
				visible: false,
			},
		]);
	});

	it("honors active and missing display policies separately for requirement rows", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:test:present": {
					polarity: "neutral",
					grants: [
						{
							id: "grant:test:present",
							name: "Present",
						},
					],
					name: "Present Grant",
				},
				"effect:test:missing": {
					polarity: "neutral",
					grants: [
						{
							id: "grant:test:missing",
							name: "Missing",
						},
					],
					name: "Missing Grant",
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						"effect:test:present",
					],
				},
			},
			lineOverrides: {
				"line:test": appendFirstOutputEffects(baseConfig.lineCatalog["line:test"], [
					{
						display: "whenActive",
						kind: "grant.require",
						label: "Present active row",
						phase: "start",
						selector: allOfGrant("grant:test:present"),
					},
					{
						display: "whenActive",
						kind: "grant.require",
						label: "Missing active row",
						phase: "start",
						selector: allOfGrant("grant:test:missing"),
					},
					{
						display: "whenMissing",
						kind: "grant.require",
						label: "Missing row",
						phase: "start",
						selector: allOfGrant("grant:test:missing"),
					},
				]),
			},
			startingState: {
				...baseConfig.startingState,
				board: [
					...baseConfig.startingState.board,
					{
						itemId: "item:axe",
						x: 1,
						y: 0,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readTestLine({
			config,
			save,
		});

		expect(line.startRequirementsReady).toBeUndefined();
		expect(line.effectRequirements).toBeUndefined();
		expect(line.outputs).toMatchObject([
			{
				effects: [
					{
						kind: "grant.require",
						label: "Present active row",
						ready: true,
					},
					{
						kind: "grant.require",
						label: "Missing row",
						ready: false,
					},
				],
				enabled: false,
			},
		]);
	});

	it("reports active line modifiers as bonuses instead of fake missing requirements", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:test:haste": {
					polarity: "buff",
					grants: [
						{
							id: "grant:test:haste",
							name: "Haste",
						},
					],
					name: "Haste Grant",
					sourceScope: "inventory",
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						"effect:test:haste",
					],
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							itemId: "item:twig",
							quantity: 2,
							type: "guaranteed",
							effects: [
								{
									display: "whenActive",
									kind: "grant.duration.multiply",
									label: "Inventory Haste",
									multiplier: 0.5,
									selector: allOfGrant("grant:test:haste"),
								},
								{
									chance: 0.25,
									display: "whenActive",
									kind: "grant.loot.extraOutputChance.add",
									label: "Extra Twig",
									quantity: 1,
									selector: allOfGrant("grant:test:haste"),
								},
							],
						},
					],
				},
			},
			startingState: {
				...baseConfig.startingState,
				inventory: [
					{
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readTestLine({
			config,
			save,
		});

		expect(line.effectRequirements).toBeUndefined();
		expect(line.startRequirementsReady).toBeUndefined();
		expect(line.effectBonusLines).toEqual([
			"Inventory Haste: 50% faster production.",
			"Extra Twig: 25% chance for +1× Twig.",
		]);
	});

	it("uses catalog item names for nearby active bonus labels", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 2,
				},
			},
			lineOverrides: {
				"line:test": appendFirstOutputEffects(baseConfig.lineCatalog["line:test"], [
					{
						bands: [
							{
								maxDistance: 1,
								minDistance: 0,
								multiplier: 0.9,
							},
						],
						display: "whenActive",
						items: anyOfItem("item:axe"),
						kind: "nearby.duration.multiply",
						label: "Nearby item:axe enables production",
						radius: 1,
					},
				]),
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:axe",
						x: 1,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readTestLine({
			config,
			save,
		});

		expect(line.effectBonusLines).toEqual([
			"Nearby Axe enables production: 10% faster production.",
		]);
	});

	it("surfaces activated effect polarity on effect lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:test:overdrive": {
					polarity: "mixed",
					grants: [
						{
							id: "grant:test:overdrive",
							name: "Overdrive",
						},
					],
					name: "Overdrive",
					sourceScope: "board",
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					activatesEffectId: "effect:test:overdrive",
					output: undefined,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const line = readTestLine({
			config,
			save,
		});

		expect(line.kind).toBe("effect");
		expect(line.effectPolarity).toBe("mixed");
	});
});
