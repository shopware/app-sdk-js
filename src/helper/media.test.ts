import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import type { HttpClient } from "../http-client.js";
import { SyncOperation } from "./admin-api.js";
import {
	createMediaFolder,
	getMediaDefaultFolderByEntity,
	getMediaFolderByName,
	uploadMediaFile,
} from "./media.js";

describe("Test Media helper", () => {
	beforeAll(() => {
		const mockedUuid = mock(() => "mocked-uuid");

		mock.module("./admin-api", () => {
			return {
				uuid: mockedUuid,
			};
		});
	});

	afterAll(() => {
		mock.restore();
	});

	test("create media folder", async () => {
		const client = {
			post(url: string, data: unknown, headers: Record<string, string>) {
				expect(url).toBe("/_action/sync");
				expect(data).toEqual([
					new SyncOperation("upsert", "media_folder", "upsert", [
						{
							id: "mocked-uuid",
							name: "test",
							parentId: null,
							configuration: {},
						},
					]),
				]);
				return Promise.resolve();
			},
		} as unknown as HttpClient;

		const folderId = await createMediaFolder(client, "test", {});
		expect(folderId).toBe("mocked-uuid");
	});

	test("create media folder with parent", async () => {
		const client = {
			post(url: string, data: unknown, headers: Record<string, string>) {
				expect(url).toBe("/_action/sync");
				expect(data).toEqual([
					new SyncOperation("upsert", "media_folder", "upsert", [
						{
							id: "mocked-uuid",
							name: "test",
							parentId: "parent-id",
							configuration: {},
						},
					]),
				]);
				return Promise.resolve();
			},
		} as unknown as HttpClient;

		const folderId = await createMediaFolder(client, "test", {
			parentId: "parent-id",
		});
		expect(folderId).toBe("mocked-uuid");
	});

	test("get folder id by name", async () => {
		const client = {
			post(url: string, data: unknown) {
				expect(url).toBe("/search/media-folder");
				expect(data).toEqual({
					filter: [
						{
							type: "equals",
							field: "name",
							value: "test",
						},
					],
				});
				return Promise.resolve({
					body: {
						total: 1,
						data: [{ id: "folder-id" }],
					},
				});
			},
		} as unknown as HttpClient;

		const folderId = await getMediaFolderByName(client, "test");
		expect(folderId).toBe("folder-id");
	});

	test("get default folder by entity name", async () => {
		const client = {
			post(url: string, data: unknown) {
				expect(url).toBe("/search/media-default-folder");
				expect(data).toEqual({
					filter: [
						{
							type: "equals",
							field: "entity",
							value: "product",
						},
					],
				});
				return Promise.resolve({
					body: {
						total: 1,
						data: [{ folder: { id: "default-folder-id" } }],
					},
				});
			},
		} as unknown as HttpClient;

		const folderId = await getMediaDefaultFolderByEntity(client, "product");
		expect(folderId).toBe("default-folder-id");
	});

	test("uploadMediaFile", async () => {
		const requests: { url: string; data: unknown }[] = [];

		const client = {
			post(url: string, data: unknown, headers: Record<string, string>) {
				requests.push({ url, data });
				return Promise.resolve();
			},
		} as unknown as HttpClient;

		await uploadMediaFile(client, {
			file: new Blob(["test"], { type: "text/plain" }),
			fileName: "test.text",
		});

		expect(requests).toBeArrayOfSize(2);
		expect(requests[0]?.url).toBe("/_action/sync");
		expect(requests[0]?.data).toEqual([
			new SyncOperation("upsert", "media", "upsert", [
				{
					id: "mocked-uuid",
					mediaFolderId: null,
					private: false,
				},
			]),
		]);
		expect(requests[1]?.url).toBe(
			"/_action/media/mocked-uuid/upload?extension=text&fileName=test",
		);
		expect(requests[1]?.data).toBeInstanceOf(Blob);
	});

	test("uploadMediaFile without extension fails", async () => {
		const client = {
			post(url: string, data: unknown, headers: Record<string, string>) {
				return Promise.resolve();
			},
		} as unknown as HttpClient;

		expect(
			uploadMediaFile(client, {
				file: new Blob(["test"], { type: "text/plain" }),
				fileName: "test",
			}),
		).rejects.toThrow("Invalid file name, should have an extension");
	});

	test("uploadMediaFile when upload fails deletes itself", async () => {
		const requests: { url: string; data: unknown }[] = [];

		const client = {
			post(url: string, data: unknown, headers: Record<string, string>) {
				requests.push({ url, data });

				if (
					url ===
					"/_action/media/mocked-uuid/upload?extension=text&fileName=test"
				) {
					return Promise.reject(new Error("Test"));
				}

				return Promise.resolve();
			},
		} as unknown as HttpClient;

		expect(
			uploadMediaFile(client, {
				file: new Blob(["test"], { type: "text/plain" }),
				fileName: "test.text",
			}),
		).rejects.toThrow("Test");

		expect(requests).toBeArrayOfSize(3);

		expect(requests[0]?.url).toBe("/_action/sync");
		expect(requests[0]?.data).toEqual([
			new SyncOperation("upsert", "media", "upsert", [
				{
					id: "mocked-uuid",
					mediaFolderId: null,
					private: false,
				},
			]),
		]);
		expect(requests[1]?.url).toBe(
			"/_action/media/mocked-uuid/upload?extension=text&fileName=test",
		);
		expect(requests[1]?.data).toBeInstanceOf(Blob);
		expect(requests[2]?.url).toBe("/_action/sync");
		expect(requests[2]?.data).toEqual([
			new SyncOperation("delete", "media", "delete", [
				{
					id: "mocked-uuid",
				},
			]),
		]);
	});
});
