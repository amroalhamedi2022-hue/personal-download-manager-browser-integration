// Source-only regression harness: no Vite/extension build or executable packaging.
// Run after npm ci: node --test scripts/tests/HyperGetNativeTransportSourceSmoke.cjs
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(
    path.join(root, "src/backend/nativemessaging/NativeMessagingTransport.ts"), "utf8"
);
const js = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
    reportDiagnostics: true,
});
assert.equal(js.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);

class NetworkError extends Error {}
class AppApiError extends Error {}

class FakePort {
    constructor() {
        this.sent = [];
        this.messageListeners = [];
        this.disconnectListeners = [];
        this.onMessage = {addListener: listener => this.messageListeners.push(listener)};
        this.onDisconnect = {addListener: listener => this.disconnectListeners.push(listener)};
    }
    postMessage(message) { this.sent.push(message); }
    disconnect() { this.disconnected = true; }
    emitMessage(message) { for (const fn of this.messageListeners) fn(message); }
    emitDisconnect() { for (const fn of this.disconnectListeners) fn(this); }
}

function setup(timeout = 200) {
    const ports = [];
    const logs = [];
    let id = 0;
    const browser = {
        runtime: {
            lastError: null,
            connectNative() {
                const port = new FakePort();
                ports.push(port);
                return port;
            },
            async sendNativeMessage(_packageName, message) {
                return {id: message.id, content: {action: message.content.action, isError: false, payload: "null"}};
            },
        },
    };
    const exports = {};
    const sandbox = {
        exports,
        module: {exports},
        setTimeout,
        clearTimeout,
        console: {
            warn: (...args) => logs.push(args.join(" ")),
            log: (...args) => logs.push(args.join(" ")),
            debug: (...args) => logs.push(args.join(" ")),
        },
        require(name) {
            if (name === "webextension-polyfill") return browser;
            if (name === "~/backend/BackendError") return {NetworkError, AppApiError};
            if (name === "./NativeMessagingProtocol") return {
                generateMessageId: () => "B_" + (++id),
                isNativeMessagingMessage: value =>
                    typeof value?.id === "string" &&
                    typeof value?.content?.payload === "string" &&
                    typeof value?.content?.isError === "boolean",
                processResponseOrThrow: value => {
                    if (value.content.isError) throw new AppApiError("Native error");
                    return value.content;
                },
            };
            throw new Error("Unexpected import " + name);
        },
    };
    vm.runInNewContext(js.outputText, sandbox, {filename: "NativeMessagingTransport.js"});
    const Transport = sandbox.module.exports.NativeMessagingTransport;
    return {transport: new Transport("app.personaldownloadmanager", timeout), ports, logs, browser};
}

function reply(port, request) {
    port.emitMessage({
        id: request.id,
        content: {action: request.content.action, isError: false, payload: "true"},
    });
}

test("explicit disconnect immediately rejects in-flight requests", async () => {
    const {transport, ports} = setup();
    transport.connect();
    const pending = transport.requestTyped("ping", null);
    assert.equal(ports[0].sent.length, 1);
    transport.disconnect();
    await assert.rejects(pending, /disconnected/);
    assert.equal(transport.isConnected(), false);
});

test("late old-port disconnect must not reject a new-port request", async () => {
    const {transport, ports} = setup();
    transport.connect();
    const old = ports[0];
    transport.disconnect();
    transport.connect();
    const fresh = ports[1];
    const pending = transport.requestTyped("ping", null);
    old.emitDisconnect();
    assert.equal(transport.isConnected(), true);
    reply(fresh, fresh.sent[0]);
    assert.equal(await pending, true);
});

test("late old-port response cannot resolve a new-port request", async () => {
    const {transport, ports} = setup();
    transport.connect();
    const old = ports[0];
    transport.disconnect();
    transport.connect();
    const fresh = ports[1];
    const pending = transport.requestTyped("ping", null);
    let settled = false;
    pending.finally(() => { settled = true; });
    reply(old, fresh.sent[0]);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(settled, false);
    reply(fresh, fresh.sent[0]);
    assert.equal(await pending, true);
});

test("current-port disconnect rejects all pending requests and allows reconnect", async () => {
    const {transport, ports} = setup();
    transport.connect();
    const a = transport.requestTyped("ping", null);
    const b = transport.requestTyped("add", {items: []});
    ports[0].emitDisconnect();
    await Promise.all([
        assert.rejects(a, /disconnected/),
        assert.rejects(b, /disconnected/),
    ]);
    assert.equal(transport.isConnected(), false);
    transport.connect();
    const c = transport.requestTyped("ping", null);
    reply(ports[1], ports[1].sent[0]);
    assert.equal(await c, true);
});

test("timeout clears pending state; late response cannot resolve a new request", async () => {
    const {transport, ports} = setup(15);
    transport.connect();
    const first = transport.requestTyped("ping", null);
    await assert.rejects(first, /timed out/);
    const second = transport.requestTyped("ping", null);
    reply(ports[0], ports[0].sent[0]);
    reply(ports[0], ports[0].sent[1]);
    assert.equal(await second, true);
    transport.disconnect();
});

test("malformed native messages never print secrets to browser logs", async () => {
    const {transport, ports, logs} = setup();
    transport.connect();
    ports[0].emitMessage({token: "SECRET_TOKEN_SENTINEL"});
    ports[0].emitMessage({
        id: "unknown", content: {action: "add", isError: false, payload: "SECRET_TOKEN_SENTINEL"},
    });
    assert.equal(logs.join(" ").includes("SECRET_TOKEN_SENTINEL"), false);
    transport.disconnect();
});

test("one-shot native request times out when the host never replies", async () => {
    const {transport, browser, ports} = setup(20);
    browser.runtime.sendNativeMessage = () => new Promise(() => {});
    await assert.rejects(transport.requestTyped("ping", null), /timed out: ping/);
    assert.equal(ports.length, 0);
});

test("one-shot native request retains error wrapping when the host rejects", async () => {
    const {transport, browser} = setup(100);
    browser.runtime.sendNativeMessage = async () => {
        throw new Error("native host unavailable");
    };
    await assert.rejects(transport.requestTyped("ping", null), /Failed to send native message/);
});

test("one-shot late host reply cannot turn a timed-out request into success", async () => {
    const {transport, browser} = setup(20);
    let replyLater;
    browser.runtime.sendNativeMessage = () => new Promise(resolve => { replyLater = resolve; });
    const pending = transport.requestTyped("ping", null);
    await assert.rejects(pending, /timed out/);
    replyLater({id: "B_1", content: {action: "ping", isError: false, payload: "true"}});
    await new Promise(resolve => setImmediate(resolve));
});

test("one-shot request path remains compatible with existing native host identity", async () => {
    const {transport, ports} = setup();
    assert.equal(await transport.requestTyped("ping", null), null);
    assert.equal(ports.length, 0);
});

test("user-visible browser branding changes do not rename protocol identities", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const messages = JSON.parse(fs.readFileSync(path.join(root, "public/_locales/en/messages.json"), "utf8"));
    const constants = fs.readFileSync(path.join(root, "src/utils/Constants.ts"), "utf8");
    const firefox = fs.readFileSync(path.join(root, "src/manifest/manifest.firefox.ts"), "utf8");
    assert.equal(pkg.displayName, "HyperGet Browser Integration");
    assert.equal(messages.abdm_notification_title.message, "HyperGet");
    assert.ok(constants.includes('packageName: "app.personaldownloadmanager"'));
    assert.ok(firefox.includes("browser-integration@personaldownloadmanager.local"));
});
