import type { HttpClient } from "../http-client.js";
import { EntityRepository, uuid } from "./admin-api.js";
import { Criteria } from "./criteria.js";

/**
 * Uploads a media file to the Shopware instance.
 *
 * @param {HttpClient} httpClient - The HTTP client instance.
 * @param {Object} options - The options for uploading the media file.
 * @param {boolean} [options.private] - Whether the media file should be private.
 * @param {string} [options.mediaFolderId] - The ID of the media folder to upload the file to.
 * @param {string} options.fileName - The name of the file to upload.
 * @param {Blob|Promise<Blob>} options.file - The file to upload.
 */
export async function uploadMediaFile(
	httpClient: HttpClient,
	{
		private: isPrivate = false,
		mediaFolderId = null,
		fileName,
		file,
	}: {
		private?: boolean;
		mediaFolderId?: string | null;
		fileName: string;
		file: Blob | Promise<Blob>;
	},
) {
	const repository = new EntityRepository(httpClient, "media");

	const mediaId = uuid();

	await repository.upsert([
		{
			id: mediaId,
			private: isPrivate,
			mediaFolderId,
		},
	]);

	const splitFileName = fileName.split(".");

	if (splitFileName.length < 2) {
		throw new Error("Invalid file name, should have an extension");
	}

	const extension = (splitFileName.slice(-1)[0] || "").toLowerCase();
	const baseFileName = splitFileName.slice(0, -1).join(".");

	const params = new URLSearchParams();

	params.append("extension", extension);
	params.append("fileName", baseFileName);

	const resolved = await file;

	try {
		await httpClient.post(
			`/_action/media/${mediaId}/upload?${params.toString()}`,
			resolved,
			{
				"Content-Type": resolved.type,
			},
		);
	} catch (e) {
		await repository.delete([{ id: mediaId }]);
		throw e;
	}
}

/**
 * Retrieves the default media folder ID for a given entity.
 *
 * @param {HttpClient} httpClient - The HTTP client instance.
 * @param {string} entity - The entity name to get the default folder ID for.
 * @returns {Promise<string|null>} - The ID of the default media folder or null if not found.
 */
export async function getMediaDefaultFolderByEntity(
	httpClient: HttpClient,
	entity: string,
): Promise<string | null> {
	const mediaDefaultFolder = new EntityRepository<{ folder: { id: string } }>(
		httpClient,
		"media_default_folder",
	);

	const criteria = new Criteria();
	criteria.addFilter(Criteria.equals("entity", entity));

	const folders = await mediaDefaultFolder.search(criteria);

	const firstFolder = folders.first();
	return firstFolder?.folder?.id || null;
}

/**
 * Retrieves the media folder ID by its name.
 *
 * @param {HttpClient} httpClient - The HTTP client instance.
 * @param {string} name - The name of the media folder.
 * @returns {Promise<string|null>} - The ID of the media folder or null if not found.
 */
export async function getMediaFolderByName(
	httpClient: HttpClient,
	name: string,
): Promise<string | null> {
	const mediaFolder = new EntityRepository<{ id: string }>(
		httpClient,
		"media_folder",
	);

	const criteria = new Criteria();
	criteria.addFilter(Criteria.equals("name", name));

	const folders = await mediaFolder.search(criteria);

	return folders.first()?.id || null;
}

interface CreateMediaFolderOptions {
	parentId?: string;
}

/**
 * Creates a new media folder.
 *
 * @param {HttpClient} httpClient - The HTTP client instance.
 * @param {string} name - The name of the media folder.
 * @param {Object} options - Additional options for creating the media folder.
 * @param {string} [options.parentId] - The ID of the parent folder, if any.
 * @returns {Promise<string>} - The ID of the newly created media folder.
 */
export async function createMediaFolder(
	httpClient: HttpClient,
	name: string,
	options: CreateMediaFolderOptions,
): Promise<string> {
	const repository = new EntityRepository(httpClient, "media_folder");

	const mediaFolderId = uuid();

	await repository.upsert([
		{
			id: mediaFolderId,
			name,
			parentId: options.parentId || null,
			configuration: {},
		},
	]);

	return mediaFolderId;
}
