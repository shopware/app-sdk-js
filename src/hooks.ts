import type {
	AppActivateEvent,
	AppDeactivateEvent,
	AppInstallEvent,
	AppUninstallEvent,
	AppUpdateEvent,
	ShopAuthorizeEvent,
	BeforeRegistrationEvent,
} from "./registration.js";
import type { ShopInterface } from "./repository.js";

interface HookRegistry<Shop extends ShopInterface> {
	onAuthorize: (event: ShopAuthorizeEvent<Shop>) => Promise<void>;
	onAppInstall: (event: AppInstallEvent<Shop>) => Promise<void>;
	onAppUninstall: (event: AppUninstallEvent<Shop>) => Promise<void>;
	onAppActivate: (event: AppActivateEvent<Shop>) => Promise<void>;
	onAppDeactivate: (event: AppDeactivateEvent<Shop>) => Promise<void>;
	onAppUpdate: (event: AppUpdateEvent<Shop>) => Promise<void>;
	onBeforeRegistrationEvent: (event: BeforeRegistrationEvent) => Promise<void>;
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
		const listeners = this.eventListeners.get(event);

		if (!listeners) {
			return;
		}

		for (const cb of listeners) {
			// @ts-expect-error
			const res = cb(...args);

			if (res instanceof Promise) {
				await res;
			}
		}
	}
}
