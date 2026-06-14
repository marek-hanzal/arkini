import Phaser from "phaser";
import { inventoryColumns } from "~/inventory/inventoryColumns";
import { clamp01 } from "~/phaser/common/clamp01";
import { colors } from "~/phaser/common/colors";
import { loadItemTextures } from "~/phaser/common/itemTextureKey";
import { PhaserItemActor } from "~/phaser/common/PhaserItemActor";
import { tweenPromise } from "~/phaser/common/tweenPromise";
import type { InventorySlot, InventoryView, ItemCatalogView } from "~/play/logic/playTypes";

export namespace PhaserInventoryScene {
	export interface Handlers {
		swap(source: InventorySlot, target: InventorySlot): Promise<void>;
		place(slot: InventorySlot): Promise<void>;
	}

	export interface Props {
		inventory: InventoryView;
		items: ItemCatalogView;
		handlers: Handlers;
	}

	export interface SlotRect {
		x: number;
		y: number;
		width: number;
		height: number;
		centerX: number;
		centerY: number;
	}
}

interface InventoryActorState {
	actor: PhaserItemActor;
	slot: InventorySlot;
}

interface DragState {
	actor: PhaserItemActor;
	slot: InventorySlot;
	origin: Phaser.Math.Vector2;
}

export class PhaserInventoryScene extends Phaser.Scene {
	private props?: PhaserInventoryScene.Props;
	private ready = false;
	private actors = new Map<string, InventoryActorState>();
	private slotGraphics = new Map<number, Phaser.GameObjects.Graphics>();
	private effects = new Map<number, { errorUntil?: number; successUntil?: number }>();
	private hoverSlot?: number;
	private cellWidth = 1;
	private cellHeight = 1;
	private rowCount = 1;
	private dragging?: DragState;
	private busy = false;
	private lastTap?: { slotIndex: number; at: number };
	private lastDragAt = 0;

	constructor() {
		super("arkini-inventory");
	}

	setProps(props: PhaserInventoryScene.Props) {
		this.props = props;
		if (!this.ready) return;
		this.ensureTextures(props.items);
		this.applySnapshot();
	}

	resize(width: number, height: number) {
		this.rowCount = Math.max(1, Math.ceil((this.props?.inventory.slots.length ?? 1) / inventoryColumns));
		this.cellWidth = width / inventoryColumns;
		this.cellHeight = height / this.rowCount;
		if (!this.ready) return;
		this.drawGrid();
		this.layoutActors(false);
	}

	preload() {
		if (this.props) loadItemTextures(this, this.props.items);
	}

	create() {
		this.ready = true;
		this.cameras.main.setBackgroundColor("rgba(2,6,23,0)");
		this.installInput();
		this.drawGrid();
		this.applySnapshot();
	}

	override update() {
		this.drawGrid();
	}

	private ensureTextures(items: ItemCatalogView) {
		if (this.load.isLoading()) return;
		const queued = loadItemTextures(this, items);
		if (queued) {
			this.load.once(Phaser.Loader.Events.COMPLETE, () => this.applySnapshot());
			this.load.start();
		}
	}

	private installInput() {
		this.input.on("dragstart", (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
			if (this.busy) return;
			const actor = this.actorByContainer(gameObject);
			if (!actor) return;
			this.lastTap = undefined;
			this.dragging = {
				actor: actor.actor,
				slot: actor.slot,
				origin: new Phaser.Math.Vector2(actor.actor.container.x, actor.actor.container.y),
			};
			actor.actor.setRaised(true);
		});

		this.input.on("drag", (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
			if (!this.dragging || this.dragging.actor.container !== gameObject) return;
			this.dragging.actor.container.setPosition(dragX, dragY);
			this.hoverSlot = this.slotAt(dragX, dragY);
		});

		this.input.on("dragend", (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
			if (!this.dragging || this.dragging.actor.container !== gameObject) return;
			void this.finishDrag();
		});
	}

	private applySnapshot() {
		if (!this.ready || !this.props) return;
		this.rowCount = Math.max(1, Math.ceil(this.props.inventory.slots.length / inventoryColumns));
		const stacks = this.props.inventory.slots.filter((slot) => slot.stack);
		const nextStackIds = new Set(stacks.map((slot) => slot.stack?.id).filter(Boolean));
		for (const [stackId, state] of this.actors) {
			if (!nextStackIds.has(stackId)) {
				this.fadeDestroy(state.actor);
				this.actors.delete(stackId);
			}
		}

		for (const slot of stacks) {
			const stack = slot.stack;
			if (!stack) continue;
			const item = this.props.items[stack.itemId];
			if (!item) continue;
			const existing = this.actors.get(stack.id);
			const size = this.actorSize();
			if (existing) {
				existing.slot = slot;
				existing.actor.update({
					item,
					size,
					quantity: stack.quantity,
				});
				if (this.dragging?.slot.stack?.id !== stack.id) {
					const rect = this.slotRect(slot.slotIndex);
					this.tweenActorTo(existing.actor, rect.centerX, rect.centerY, 170);
				}
				continue;
			}

			const actor = new PhaserItemActor({
				scene: this,
				item,
				size,
				quantity: stack.quantity,
			});
			actor.container.setData("stackId", stack.id);
			actor.container.setData("slotIndex", slot.slotIndex);
			actor.container.on("pointerup", () => this.handleSlotTap(slot.slotIndex));
			const rect = this.slotRect(slot.slotIndex);
			actor.container.setPosition(rect.centerX, rect.centerY);
			actor.container.setAlpha(0);
			actor.container.setScale(0.78);
			this.actors.set(stack.id, {
				actor,
				slot,
			});
			this.tweens.add({
				targets: actor.container,
				alpha: 1,
				scale: 1,
				duration: 220,
				ease: "Back.easeOut",
			});
		}
	}

	private layoutActors(animate: boolean) {
		if (!this.props) return;
		for (const state of this.actors.values()) {
			const stack = state.slot.stack;
			if (!stack) continue;
			const item = this.props.items[stack.itemId];
			if (item) {
				state.actor.update({
					item,
					size: this.actorSize(),
					quantity: stack.quantity,
				});
			}
			const rect = this.slotRect(state.slot.slotIndex);
			if (animate) this.tweenActorTo(state.actor, rect.centerX, rect.centerY, 160);
			else state.actor.container.setPosition(rect.centerX, rect.centerY);
		}
	}

	private drawGrid() {
		if (!this.props) return;
		const now = Date.now();
		for (const slot of this.props.inventory.slots) {
			let graphics = this.slotGraphics.get(slot.slotIndex);
			if (!graphics) {
				graphics = this.add.graphics();
				graphics.setDepth(0);
				this.slotGraphics.set(slot.slotIndex, graphics);
			}
			this.drawSlot(graphics, slot.slotIndex, now);
		}
	}

	private drawSlot(graphics: Phaser.GameObjects.Graphics, slotIndex: number, now: number) {
		const rect = this.slotRect(slotIndex);
		const effect = this.effects.get(slotIndex);
		const hover = this.hoverSlot === slotIndex;
		graphics.clear();
		graphics.fillStyle(colors.cellBase, 0.74);
		graphics.fillRoundedRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2, Math.min(rect.width, rect.height) * 0.08);
		graphics.lineStyle(1, colors.cellStroke, 0.68);
		graphics.strokeRoundedRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2, Math.min(rect.width, rect.height) * 0.08);
		if (hover) {
			graphics.fillStyle(colors.merge, 0.18);
			graphics.fillRoundedRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6, Math.min(rect.width, rect.height) * 0.08);
			graphics.lineStyle(2, colors.mergeStrong, 0.72);
			graphics.strokeRoundedRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6, Math.min(rect.width, rect.height) * 0.08);
		}
		if (effect?.errorUntil && effect.errorUntil > now) {
			const life = clamp01((effect.errorUntil - now) / 520);
			graphics.fillStyle(colors.error, 0.32 * life);
			graphics.fillRoundedRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6, Math.min(rect.width, rect.height) * 0.08);
			graphics.lineStyle(3, colors.error, 0.9 * life);
			graphics.strokeRoundedRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6, Math.min(rect.width, rect.height) * 0.08);
		}
		if (effect?.successUntil && effect.successUntil > now) {
			const life = clamp01((effect.successUntil - now) / 520);
			graphics.lineStyle(3, colors.mergeStrong, 0.8 * life);
			graphics.strokeRoundedRect(rect.x + 4, rect.y + 4, rect.width - 8, rect.height - 8, Math.min(rect.width, rect.height) * 0.08);
		}
	}

	private async finishDrag() {
		if (!this.dragging || !this.props) return;
		const drag = this.dragging;
		this.dragging = undefined;
		this.lastDragAt = Date.now();
		const targetSlotIndex = this.slotAt(drag.actor.container.x, drag.actor.container.y);
		this.hoverSlot = undefined;

		if (targetSlotIndex === undefined || targetSlotIndex === drag.slot.slotIndex) {
			await this.returnActor(drag);
			return;
		}

		const target = this.props.inventory.bySlotIndex[targetSlotIndex];
		if (!target) {
			await this.rejectDrag(drag, targetSlotIndex);
			return;
		}

		this.busy = true;
		try {
			const targetActor = target.stack ? this.actors.get(target.stack.id)?.actor : undefined;
			const targetRect = this.slotRect(target.slotIndex);
			const originRect = this.slotRect(drag.slot.slotIndex);
			await Promise.all([
				this.tweenActorTo(drag.actor, targetRect.centerX, targetRect.centerY, 180),
				targetActor ? this.tweenActorTo(targetActor, originRect.centerX, originRect.centerY, 180) : Promise.resolve(),
			]);
			await this.props.handlers.swap(drag.slot, target);
			this.pulseSlot(target.slotIndex);
		} catch (error) {
			await this.rejectDrag(drag, targetSlotIndex);
			if (import.meta.env.DEV) console.debug("Inventory action failed", error);
		} finally {
			drag.actor.setRaised(false);
			this.busy = false;
		}
	}

	private async place(slot: InventorySlot) {
		if (!this.props || this.busy || !slot.stack) return;
		const actor = this.actors.get(slot.stack.id)?.actor;
		this.busy = true;
		try {
			if (actor) {
				await tweenPromise({
					scene: this,
					targets: actor.container,
					duration: 130,
					ease: "Back.easeIn",
					props: {
						scale: 0.78,
						alpha: 0.72,
					},
				});
			}
			await this.props.handlers.place(slot);
			this.pulseSlot(slot.slotIndex);
		} catch (error) {
			this.flashSlot(slot.slotIndex);
			actor?.flashError();
			if (import.meta.env.DEV) console.debug("Inventory place failed", error);
		} finally {
			if (actor) {
				actor.container.setAlpha(1);
				actor.container.setScale(1);
			}
			this.busy = false;
		}
	}

	private handleSlotTap(slotIndex: number) {
		if (!this.props || this.dragging || this.busy) return;
		const now = Date.now();
		if (now - this.lastDragAt < 220) return;
		const slot = this.props.inventory.bySlotIndex[slotIndex];
		if (!slot?.stack) return;
		const isDoubleTap = this.lastTap?.slotIndex === slotIndex && now - this.lastTap.at < 420;
		this.lastTap = {
			slotIndex,
			at: now,
		};
		if (isDoubleTap) void this.place(slot);
	}

	private actorByContainer(gameObject: Phaser.GameObjects.GameObject): InventoryActorState | undefined {
		for (const state of this.actors.values()) {
			if (state.actor.container === gameObject) return state;
		}
		return undefined;
	}

	private async returnActor(drag: DragState) {
		await this.tweenActorTo(drag.actor, drag.origin.x, drag.origin.y, 160);
		drag.actor.setRaised(false);
	}

	private async rejectDrag(drag: DragState, slotIndex: number | undefined) {
		this.flashSlot(slotIndex ?? drag.slot.slotIndex);
		drag.actor.flashError();
		await this.returnActor(drag);
	}

	private slotAt(x: number, y: number): number | undefined {
		const column = Math.floor(x / this.cellWidth);
		const row = Math.floor(y / this.cellHeight);
		const slotIndex = row * inventoryColumns + column;
		if (column < 0 || row < 0 || column >= inventoryColumns || row >= this.rowCount) return undefined;
		if (!this.props?.inventory.bySlotIndex[slotIndex]) return undefined;
		return slotIndex;
	}

	private slotRect(slotIndex: number): PhaserInventoryScene.SlotRect {
		const column = slotIndex % inventoryColumns;
		const row = Math.floor(slotIndex / inventoryColumns);
		return {
			x: column * this.cellWidth,
			y: row * this.cellHeight,
			width: this.cellWidth,
			height: this.cellHeight,
			centerX: column * this.cellWidth + this.cellWidth / 2,
			centerY: row * this.cellHeight + this.cellHeight / 2,
		};
	}

	private actorSize() {
		return Math.min(this.cellWidth, this.cellHeight) * 0.86;
	}

	private tweenActorTo(actor: PhaserItemActor, x: number, y: number, duration: number) {
		return tweenPromise({
			scene: this,
			targets: actor.container,
			duration,
			props: {
				x,
				y,
				alpha: 1,
				scale: 1,
			},
		});
	}

	private fadeDestroy(actor: PhaserItemActor) {
		this.tweens.add({
			targets: actor.container,
			alpha: 0,
			scale: 0.55,
			y: actor.container.y + this.cellHeight * 0.18,
			duration: 180,
			ease: "Cubic.easeIn",
			onComplete: () => actor.destroy(),
		});
	}

	private flashSlot(slotIndex: number | undefined) {
		if (slotIndex === undefined) return;
		this.effects.set(slotIndex, {
			...(this.effects.get(slotIndex) ?? {}),
			errorUntil: Date.now() + 520,
		});
	}

	private pulseSlot(slotIndex: number) {
		this.effects.set(slotIndex, {
			...(this.effects.get(slotIndex) ?? {}),
			successUntil: Date.now() + 520,
		});
	}
}
