import { describe, test, jest, expect, spyOn } from "bun:test";
import { createModalResponse, createNewTabResponse, createNotificationResponse } from "../../src/helper/app-actions.js";

describe("AppActions", async () => {
    test('createNewTabResponse', async () => {
        const resp = createNewTabResponse('test');

        expect(resp.headers.get('content-type')).toBe('application/json');
        expect(await resp.text()).toBe(JSON.stringify({ actionType: 'openNewTab', payload: { redirectUrl: 'test' } }));
    });

    test('createNotificationResponse', async () => {
        const resp = createNotificationResponse('success', 'test');

        expect(resp.headers.get('content-type')).toBe('application/json');
        expect(await resp.text()).toBe(JSON.stringify({ actionType: 'notification', payload: { status: 'success', message: 'test' } }));
    });

    test('createModalResponse', async () => {
        const resp = createModalResponse('test', 'small', true);

        expect(resp.headers.get('content-type')).toBe('application/json');
        expect(await resp.text()).toBe(JSON.stringify({ actionType: 'openModal', payload: { iframeUrl: 'test', size: 'small', expand: true } }));
    });
});