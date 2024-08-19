import { describe, test, jest, expect, spyOn } from "bun:test";
import { Registration } from "../src/registration.js";
import { AppServer } from "../src/app.js";
import { InMemoryShopRepository } from "../src/repository.js";

describe("Registration", async () => {
    const app = new AppServer({appName: 'test', appSecret: 'test', authorizeCallbackUrl: 'test'}, new InMemoryShopRepository);

    test('authorize: invalid request', async () => {
        const  resp = await app.registration.authorize(new Request('http://localhost'));

        expect(resp.status).toBe(400);
    });

    test('authorize: invalid signature', async () => {
        const  resp = await app.registration.authorize(new Request('http://localhost?shop-url=test&shop-id=test&timestamp=test', { headers: new Headers({ 'shopware-app-signature': 'test' }) }));

        expect(resp.status).toBe(401);
    });

    test('authorize: valid request', async () => {
        app.signer.verify = jest.fn().mockResolvedValue(true);

        const resp = await app.registration.authorize(new Request('http://localhost?shop-url=test&shop-id=test&timestamp=test', { headers: new Headers({ 'shopware-app-signature': 'test' }) }));

        expect(resp.status).toBe(200);
    });

    test('authorizeCallback: invalid request', async () => {
        const  resp = await app.registration.authorizeCallback(new Request('http://localhost', { body: '{}'}));

        expect(resp.status).toBe(400);
    });

    test('authorizeCallback: shop does not exist', async () => {
        const  resp = await app.registration.authorizeCallback(new Request('http://localhost', { body: '{"shopId": "test", "apiKey": "test", "secretKey": "test"}'}));

        expect(resp.status).toBe(400);
    });
});