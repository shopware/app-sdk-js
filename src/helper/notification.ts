import { HttpClient } from "../http-client.js";

interface NotificationCreateRequest {
    status: 'neutral' | 'info' | 'attention' | 'critical' | 'positive';
    message: string;
    
    // Only the admin can see this notification
    adminOnly?: boolean;
    // The user must have these privileges to see this notification
    requiredPrivileges?: string[];
}

export async function sendNotification(httpClient: HttpClient, notification: NotificationCreateRequest): Promise<void> {
    await httpClient.post('/notification', notification)
}
