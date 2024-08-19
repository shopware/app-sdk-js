import { describe, test, jest, expect, spyOn } from "bun:test";
import {Hono} from "hono";
import { configureAppServer } from "../../src/framework/hono.js";
import { InMemoryShopRepository } from "../../src/repository.js";
import { WebCryptoHmacSigner } from "../../src/signer.js";

describe('Hono', async () => {
    const repo = new InMemoryShopRepository();

    await repo.createShop(repo.createShopStruct('a', 'a', 'a'));

    test('configre by functions', async () => {
        const hono = new Hono();

        configureAppServer(hono, {
            appName: () => 'test',
            appSecret: () => 'test',
            shopRepository: () => repo,
        });

        const resp = await hono.fetch(new Request('http://localhost/app/register'));

        expect(resp.status).toBe(400);
    });

    test('register', async () => {
        const hono = new Hono();

        configureAppServer(hono, {
            appName: 'test',
            appSecret: 'test',
            shopRepository: repo,
        });

        const resp = await hono.fetch(new Request('http://localhost/app/register'));

        expect(resp.status).toBe(400);
    });

    test('register: success', async () => {
        const hono = new Hono();

        configureAppServer(hono, {
            appName: 'My App',
            appSecret: 'my-secret',
            shopRepository: repo,
        });

        const resp = await hono.fetch(new Request('http://localhost/app/register?shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890', { headers: new Headers({ 'shopware-app-signature': '9dc0fce19213bef78ad62a39fe552380f7333350c0236221cdb321f33474ed65' }) }));

        expect(resp.status).toBe(200);

        const body = await resp.json();

        expect(body).toBeObject();

        expect(body.proof).not.toBeNull();
    });

    test('registerConfirm', async () => {
        const hono = new Hono();

        configureAppServer(hono, {
            appName: 'test',
            appSecret: 'test',
            shopRepository: repo,
        });

        const resp = await hono.fetch(new Request('http://localhost/app/register/confirm', {method: 'POST', body: '{}'}));

        expect(resp.status).toBe(400);
    });

    test('signature failure', async () => {
        const hono = new Hono();

        configureAppServer(hono, {
            appName: 'test',
            appSecret: 'test',
            shopRepository: repo,
        });

        hono.get('/app/test', c => c.text('ok'));

        const resp = await hono.fetch(new Request('http://localhost/app/test?shopware-shop-signature=invalid&shop-id=a'));

        expect(resp.status).toBe(400);
        expect(await resp.text()).toBe('{"message":"Invalid request"}');
    });

    test('signature success', async () => {
        const hono = new Hono();

        configureAppServer(hono, {
            appName: 'test',
            appSecret: 'test',
            shopRepository: repo,
        });

        hono.get('/app/test', c => c.text('ok'));

        const resp = await hono.fetch(new Request('http://localhost/app/test?shopware-shop-signature=8b523d99aeef5b456288fcec48236c3367a914c6b2c9fded63d81257ac019b25&shop-id=a'));

        expect(resp.status).toBe(200);
        expect(await resp.text()).toBe('ok');
        expect(resp.headers.get('shopware-app-signature')).toBe('4a43a105ccce57e8e38d4a1f7b3565d743b1e15fb1fec36f41fdf20164fa1c8b');
    });
});