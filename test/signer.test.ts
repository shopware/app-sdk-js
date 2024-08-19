import { expect, test, describe } from "bun:test";
import { WebCryptoHmacSigner } from "../src/signer.js";

describe("Signer", () => {
  test("signResponse", async () => {
    const signer = new WebCryptoHmacSigner();

    const response = new Response("Hello, World!");

    await signer.signResponse(response, 'test');

    expect(response.headers.get("shopware-app-signature")).toBe('52589bd80ccfa4acbb3f9512dfaf4f700fa5195008aae0b77a9e47dcca75beac');

    await signer.signResponse(response, 'test');

    expect(response.headers.get("shopware-app-signature")).toBe('52589bd80ccfa4acbb3f9512dfaf4f700fa5195008aae0b77a9e47dcca75beac');
  });

  test("sign", async () => {
    const signer = new WebCryptoHmacSigner();

    expect(await signer.sign("shop-id=blaa", 'test')).toBe('f2cb1044ac5a2cb807e1942b06433d23d66bcf7dfad1095b286203e5c1f39cb6');
  });

  test("verifyGetRequest", async () => {
    const signer = new WebCryptoHmacSigner();

    expect(signer.verifyGetRequest(new Request("https://example.com/?shopware-shop-signature=52589bd80ccfa4acbb3f9512dfaf4f700fa5195008aae0b77a9e47dcca75beac"), 'test')).rejects.toThrowError('Missing query parameters to verify the GET request');
    expect(signer.verifyGetRequest(new Request("https://example.com/?shopware-shop-signature=52589bd80ccfa4acbb3f9512dfaf4f700fa5195008aae0b77a9e47dcca75beac&a=1"), 'test')).rejects.toThrowError('Invalid signature');

    expect(signer.verifyGetRequest(new Request("https://example.com/?shopware-shop-signature=f2cb1044ac5a2cb807e1942b06433d23d66bcf7dfad1095b286203e5c1f39cb6&shop-id=blaa"), 'test')).resolves.pass();
  });
});