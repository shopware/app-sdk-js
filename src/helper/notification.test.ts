import { describe, test, expect, jest } from "bun:test";
import { sendNotification } from "./notification.js";
import { HttpClient } from "../http-client.js";

describe("Notification", () => {
    test("should send a notification", async () => {
        const httpClient = new HttpClient({} as any);
        httpClient.post = jest.fn();

        const notification = {
            status: "neutral" as const,
            message: "Hello World",
        };

        await sendNotification(httpClient, notification);

        expect(httpClient.post).toHaveBeenCalledWith("/notification", notification);
    });

    test("should send a notification with admin only", async () => {
        const httpClient = new HttpClient({} as any);
        httpClient.post = jest.fn();

        const notification = {
            status: "info" as const,
            message: "Hello World",
            adminOnly: true,
        };

        await sendNotification(httpClient, notification);

        expect(httpClient.post).toHaveBeenCalledWith("/notification", notification);
    });

    test("should send a notification with required privileges", async () => {
        const httpClient = new HttpClient({} as any);
        httpClient.post = jest.fn();

        const notification = {
            status: "critical" as const,
            message: "Hello World",
            requiredPrivileges: ["read", "write"],
        };

        await sendNotification(httpClient, notification);

        expect(httpClient.post).toHaveBeenCalledWith("/notification", notification);
    });
});