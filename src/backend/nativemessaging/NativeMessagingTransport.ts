import browser, {Runtime} from "webextension-polyfill";
import {AppApiError, NetworkError} from "~/backend/BackendError";
import {
    generateMessageId,
    isNativeMessagingMessage,
    NativeMessagingMessage,
    NativeMessagingMessageContent,
    processResponseOrThrow,
} from "./NativeMessagingProtocol";


interface PendingRequest {
    readonly resolve: (response: NativeMessagingMessageContent) => void;
    readonly reject: (error: Error) => void;
    readonly timeout: ReturnType<typeof setTimeout>;
}


export class NativeMessagingTransport {

    private port: Runtime.Port | null = null;

    private readonly pendingRequests =
        new Map<string, PendingRequest>();

    private connecting = false;

    constructor(
        private readonly packageName: string,
        private readonly requestTimeout = 10_000,
    ) {
    }


    connect(): void {
        if (this.port !== null || this.connecting) {
            return;
        }

        this.connecting = true;

        try {
            const port = browser.runtime.connectNative(
                this.packageName
            );
            this.port = port;

            port.onMessage.addListener((message) => this.handleMessage(port, message));
            port.onDisconnect.addListener(this.handleDisconnect);
        } catch (e) {
            this.port = null;
            throw e;
        } finally {
            this.connecting = false;
        }
    }

    disconnect(): void {
        const port = this.port;

        this.port = null;
        // Do not wait for onDisconnect: it may be delayed or never delivered.
        this.rejectPendingRequests(new NetworkError("Native messaging disconnected"));
        port?.disconnect();
    }

    isConnected(): boolean {
        return this.port !== null;
    }

    async requestTyped<T>(
        action: string,
        payload: unknown,
    ): Promise<T> {

        const response = await this.requestRaw(
            action,
            JSON.stringify(payload),
        );

        try {
            return JSON.parse(response.payload) as T;
        } catch (e) {
            throw new NetworkError(
                `Invalid JSON response for "${action}".`, {
                    cause: e
                }
            );
        }
    }


    private async requestRaw(
        action: string,
        payload: string,
    ): Promise<NativeMessagingMessageContent> {

        const message = this.createMessage(
            action,
            payload,
        );

        const port = this.port;

        if (port == null) {
            return await this.sendOneShot(message);
        }

        return await this.sendUsingConnectedPort(port, message);
    }


    private createMessage(
        action: string,
        payload: string,
    ): NativeMessagingMessage {

        return {
            id: generateMessageId(),

            content: {
                action,
                payload,
                isError: false,
            },
        };
    }


    private sendUsingConnectedPort(
        port: Runtime.Port,
        message: NativeMessagingMessage,
    ): Promise<NativeMessagingMessageContent> {

        return new Promise(
            (resolve, reject) => {
                const timeout = setTimeout(
                    () => {
                        this.pendingRequests.delete(message.id);
                        reject(
                            new NetworkError(
                                `Native request timed out: ${message.content.action}`
                            )
                        );
                    },
                    this.requestTimeout,
                );

                this.pendingRequests.set(
                    message.id,
                    {
                        resolve,
                        reject,
                        timeout,
                    }
                );

                try {
                    port.postMessage(message);
                } catch (e) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(message.id);
                    reject(
                        new NetworkError(
                            "Failed to send native message",
                            {
                                cause: e
                            }
                        )
                    );
                }
            }
        );
    }

    private async sendOneShot(
        message: NativeMessagingMessage,
    ): Promise<NativeMessagingMessageContent> {
        try {
            const response = await browser.runtime.sendNativeMessage(
                this.packageName,
                message,
            );
            if (!isNativeMessagingMessage(response)) {
                throw new NetworkError(
                    "Invalid response from native messaging host"
                );
            }
            return processResponseOrThrow(response)
        } catch (e) {
            if (e instanceof AppApiError) {
                throw e;
            }
            if (e instanceof NetworkError) {
                throw e
            }
            throw new NetworkError(
                "Failed to send native message", {
                    cause: e
                }
            )
        }
    }

    private handleMessage = (
        port: Runtime.Port,
        message: unknown,
    ): void => {
        // A disconnected port may still deliver queued callbacks after reconnect.
        if (this.port !== port) return;

        if (!isNativeMessagingMessage(message)) {
            console.warn(
                "HyperGet received an invalid native message",
            );
            return;
        }

        const pendingRequest = this.pendingRequests.get(message.id);
        if (pendingRequest === undefined) {
            // Native initiated event or unknown message.
            // it's a good idea to add event handler here too.
            // Never print arbitrary native payloads: they may include URLs,
            // request headers, cookies or authentication tokens.
            console.debug("HyperGet ignored an unmatched native response");
            return;
        }

        clearTimeout(pendingRequest.timeout);
        this.pendingRequests.delete(message.id);

        try {
            pendingRequest.resolve(processResponseOrThrow(message))
        } catch (e) {
            let err: Error
            if (e instanceof AppApiError) {
                err = e
            } else if (e instanceof NetworkError) {
                err = e
            } else {
                err = new NetworkError(
                    "Failed to handle native response",
                    {
                        cause: e
                    }
                )
            }
            pendingRequest.reject(err)
        }
    };

    private rejectPendingRequests(error: Error): void {
        const pending = [...this.pendingRequests.values()];
        this.pendingRequests.clear();
        for (const request of pending) {
            clearTimeout(request.timeout);
            request.reject(error);
        }
    }

    private handleDisconnect = (
        port: Runtime.Port,
    ): void => {
        // Ignore delayed disconnect events from a previous native connection.
        // They must not reject requests belonging to a replacement port.
        if (this.port !== port) return;
        this.port = null;

        const message =
            port.error?.message ??
            browser.runtime.lastError?.message ??
            "Native messaging was disconnected";
        this.rejectPendingRequests(new NetworkError(message));
        // Avoid logging browser-provided error details or request payloads.
        console.debug("HyperGet native messaging disconnected");
    };
}
