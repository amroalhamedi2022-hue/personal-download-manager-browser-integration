const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Execute actual TypeScript transport/protocol/error modules against a deterministic
// browser runtime. No browser extension signing keys, network or real host needed.
function loadTransport(runtime) {
    const cache = new Map();
    const root = path.resolve(__dirname, "../src");
    function load(file) {
        if (cache.has(file)) return cache.get(file).exports;
        const module = {exports: {}};
        cache.set(file, module);
        const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
            compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true},
            fileName: file,
        }).outputText;
        const localRequire = name => {
            if (name === "webextension-polyfill") return {runtime};
            if (name.startsWith("~/")) return load(path.join(root, name.slice(2) + ".ts"));
            if (name.startsWith(".")) return load(path.resolve(path.dirname(file), name + ".ts"));
            return require(name);
        };
        new Function("require", "module", "exports", js)(localRequire, module, module.exports);
        return module.exports;
    }
    return load(path.join(root, "backend/nativemessaging/NativeMessagingTransport.ts")).NativeMessagingTransport;
}

function signal() {
    const listeners = [];
    return {addListener(fn) {listeners.push(fn);}, emit(value) {for (const fn of listeners) fn(value);}};
}
function fakePort() {
    const port = {
        onMessage: signal(), onDisconnect: signal(), sent: [],
        postMessage(message) {this.sent.push(message);},
        // Browsers may not emit onDisconnect to the side calling disconnect().
        disconnect() {},
    };
    return port;
}
function reply(message, overrides = {}) {
    return {id: message.id, content: {action: null, isError: false, payload: "true"}, ...overrides};
}

test("one-shot response must echo its request ID", async () => {
    const Transport = loadTransport({sendNativeMessage: async (_, request) => reply(request, {id: "B_wrong"})});
    await assert.rejects(new Transport("host").requestTyped("ping", null), /Invalid response/);
});
test("one-shot correlated reply succeeds", async () => {
    const Transport = loadTransport({sendNativeMessage: async (_, request) => reply(request)});
    assert.equal(await new Transport("host").requestTyped("ping", null), true);
});
test("one-shot request cannot hang indefinitely", async () => {
    const Transport = loadTransport({sendNativeMessage: () => new Promise(() => {})});
    await assert.rejects(new Transport("host", 25).requestTyped("ping", null), /timed out/);
});
test("disconnect rejects pending requests even without an onDisconnect event", async () => {
    const port = fakePort();
    const Transport = loadTransport({connectNative: () => port});
    const transport = new Transport("host");
    transport.connect();
    const rejected = assert.rejects(transport.requestTyped("ping", null), /disconnected/);
    transport.disconnect();
    await rejected;
    assert.equal(transport.isConnected(), false);
});
test("late old-port replies and disconnects do not affect the replacement port", async () => {
    const first = fakePort(), second = fakePort();
    const ports = [first, second];
    const Transport = loadTransport({connectNative: () => ports.shift()});
    const transport = new Transport("host");
    transport.connect();
    const old = assert.rejects(transport.requestTyped("ping", null), /disconnected/);
    transport.disconnect();
    await old;
    transport.connect();
    const request = transport.requestTyped("ping", null);
    first.onMessage.emit(reply(second.sent[0], {content: {action: null, isError: false, payload: "false"}}));
    first.onDisconnect.emit(first);
    second.onMessage.emit(reply(second.sent[0]));
    assert.equal(await request, true);
    assert.equal(transport.isConnected(), true);
});
test("a request-shaped message is not accepted as a response", async () => {
    const port = fakePort();
    const Transport = loadTransport({connectNative: () => port});
    const transport = new Transport("host");
    transport.connect();
    const result = assert.rejects(transport.requestTyped("ping", null), /Invalid native messaging response action/);
    port.onMessage.emit(reply(port.sent[0], {content: {action: "ping", isError: false, payload: "true"}}));
    await result;
});
test("out-of-order replies preserve independent request identity", async () => {
    const port = fakePort();
    const Transport = loadTransport({connectNative: () => port});
    const transport = new Transport("host");
    transport.connect();
    const requests = Array.from({length: 16}, () => transport.requestTyped("ping", null));
    for (let i = 15; i >= 0; i--) {
        port.onMessage.emit(reply(port.sent[i], {content: {action: null, isError: false, payload: JSON.stringify(i)}}));
    }
    assert.deepEqual(await Promise.all(requests), Array.from({length: 16}, (_, i) => i));
});
