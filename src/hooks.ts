import type { ShopAuthroizeEvent } from "./registration.js";
import type { ShopInterface } from "./repository.js";

interface HookRegistry<Shop extends ShopInterface> {
	onAuthorize: (event: ShopAuthroizeEvent<Shop>) => Promise<void>;
}

export class Hooks<Shop extends ShopInterface = ShopInterface> {
	private eventListeners = new Map<
		keyof HookRegistry<Shop>,
		HookRegistry<Shop>[keyof HookRegistry<Shop>][]
	>();

	hasListeners(event: keyof HookRegistry<Shop>): boolean {
		return this.eventListeners.has(event);
	}

	on(
		event: keyof HookRegistry<Shop>,
		cb: HookRegistry<Shop>[keyof HookRegistry<Shop>],
	) {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, []);
		}

		this.eventListeners.get(event)?.push(cb);
	}

	async publish(
		event: keyof HookRegistry<Shop>,
		...args: Parameters<HookRegistry<Shop>[keyof HookRegistry<Shop>]>
	): Promise<void> {
		const events = this.eventListeners.get(event);

		if (!events) {
			return;
		}

		for (const cb of events) {
			const res = cb(...args);

			if (res instanceof Promise) {
				await res;
			}
		}
	}
}
