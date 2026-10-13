// 云剪贴板端到端加密在宿主一侧的那一半：`AccountCloudBridge` 怎样跑原生驱动。驱动本身（密码学和流程）在 client-core 里测，这里用按脚本应答的假驱动，只看宿主做的事：发什么请求、把什么交回、什么时候保存和删除密钥串、错误码怎样原样交出去。
import {
  AccountCloudBridge,
  AccountSessionStore,
  AccountTransport,
  AccountTransportResponse,
  CloudClipboardE2eHost,
  parseClipboardDriverStep,
} from "../entry/src/main/ets/account/AccountCloudBridge";
import {
  CloudClipboardPolicy,
  CloudClipboardSendOutcome,
} from "../entry/src/main/ets/keyboard/clipboard/CloudClipboardPolicy";

let failures = 0;
let checks = 0;

/** 放在本地定义，这样测试套件不需要 node 类型定义，本仓库也没有这些定义。 */
async function group(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures++;
    console.log(`FAIL  ${name}`);
    console.log(`      ${error instanceof Error ? error.message : String(error)}`);
  }
}

function check(condition: boolean, message: string): void {
  checks++;
  if (!condition) {
    throw new Error(message);
  }
}

const OWN = "d".repeat(32);
const OTHER = "e".repeat(32);
const KEYS_PATH = `/v1/users/me/clipboard/keys?device_id=${OWN}`;
const ACCESS = "a".repeat(64);

function session(user = "synthetic-user", refresh = "b", expiresAt = Date.now() + 600_000): string {
  return JSON.stringify({
    access_token: ACCESS,
    refresh_token: refresh.repeat(64),
    token_type: "Bearer",
    expires_at: expiresAt,
    user: { id: user, display_name: "Synthetic", created_at: "2026-01-01" },
  });
}

type Json = Record<string, unknown>;
type Call = { method: string; path: string; token?: string; body?: Json };

/** 驱动的一步，裹在 C ABI 的 `{ok:true,value}` 里。 */
function step(value: Json): Json {
  return { ok: true, value };
}

function request(
  method: string,
  path: string,
  body: Json | null,
  state: Json,
  keystore: string,
): Json {
  return step({
    request: { method, path, body: body === null ? null : JSON.stringify(body) },
    state,
    keystore,
  });
}

function done(result: unknown, keystore: string): Json {
  return step({ done: result, keystore });
}

function failed(status: number, code: string, keystore: string): Json {
  return step({ error: { status, code }, keystore });
}

const STATUS_VIEW = {
  enabled: true,
  status: "ready",
  device_id: OWN,
  code: "0421 9873 5530 1176",
  devices: [
    {
      device_id: OWN,
      name: "Synthetic Phone",
      created_at: "2026-10-11T08:00:00Z",
      approved: true,
      current: true,
      code: "0421 9873 5530 1176",
    },
    {
      device_id: OTHER,
      name: "Synthetic Laptop",
      created_at: "2026-10-11T09:00:00Z",
      approved: false,
      current: false,
      code: "1111 2222 3333 4444",
    },
  ],
};

const LIST_VIEW = {
  enabled: true,
  retention_days: 7,
  items: [
    {
      id: "c".repeat(64),
      text: "合成的第一条",
      updated_at: "2026-10-11T08:00:00Z",
      pinned: true,
      device: "Synthetic Laptop",
    },
  ],
  e2e: { status: "ready", code: "0421 9873 5530 1176", pending_devices: 1, undecryptable: 0 },
};

interface Harness {
  bridge: AccountCloudBridge;
  events: string[];
  inputs: Json[];
  calls: Call[];
  disk: { session: string | null; keystore: string | null };
  clipboard(action: Json): Promise<Json>;
}

function harness(options: {
  outputs: Json[];
  respond: (
    call: Call,
    disk: { session: string | null; keystore: string | null },
  ) => Promise<AccountTransportResponse> | AccountTransportResponse;
  keystore?: string | null;
  session?: string | null;
  withoutHost?: boolean;
}): Harness {
  const events: string[] = [];
  const inputs: Json[] = [];
  const calls: Call[] = [];
  const disk = {
    session: options.session === undefined ? session() : options.session,
    keystore: options.keystore === undefined ? null : options.keystore,
  };
  const store: AccountSessionStore = {
    load: () => disk.session,
    save: (value) => {
      disk.session = value;
    },
    clear: () => {
      events.push("clear session");
      disk.session = null;
    },
  };
  const host: CloudClipboardE2eHost = {
    drive: (document) => {
      const input = JSON.parse(document) as Json;
      inputs.push(input);
      events.push(input.start !== undefined ? "drive start" : "drive resume");
      const next = options.outputs.shift();
      return next === undefined ? '{"ok":false,"error":"no scripted step"}' : JSON.stringify(next);
    },
    loadKeystore: () => disk.keystore,
    saveKeystore: (value) => {
      events.push(`save ${value}`);
      disk.keystore = value;
    },
    clearKeystore: () => {
      events.push("clear keystore");
      disk.keystore = null;
    },
    deviceName: () => "Synthetic Phone",
  };
  const transport: AccountTransport = {
    request: async (method, path, token, body) => {
      const call: Call = { method, path, token, body };
      calls.push(call);
      events.push(`${method} ${path}`);
      return await options.respond(call, disk);
    },
  };
  const bridge = new AccountCloudBridge(
    transport,
    store,
    undefined,
    options.withoutHost === true ? undefined : host,
  );
  const clipboard = async (action: Json): Promise<Json> =>
    JSON.parse(await bridge.handle(JSON.stringify({ operation: "clipboard", ...action }))) as Json;
  return { bridge, events, inputs, calls, disk, clipboard };
}

async function main(): Promise<void> {
  console.log("cloud clipboard e2e host loop");

  await group(
    "a first listing registers, saves the keystore before each request and returns the driver's shape",
    async () => {
      const pageBody = '{"enabled":true,"retention_days":7,"key_id":"k","items":[]}';
      const h = harness({
        outputs: [
          request("GET", KEYS_PATH, null, { n: 1 }, "v1.fresh"),
          request(
            "PUT",
            `/v1/users/me/clipboard/devices/${OWN}`,
            { public_key: "p", name: "Synthetic Phone" },
            { n: 2 },
            "v1.fresh",
          ),
          request("GET", "/v1/users/me/clipboard", null, { n: 3 }, "v1.fresh.key"),
          done(LIST_VIEW, "v1.fresh.key"),
        ],
        respond: (call) =>
          call.path === KEYS_PATH
            ? { status: 200, body: '{"enabled":true,"key_id":null,"wrap":null,"devices":[]}' }
            : call.method === "PUT"
              ? { status: 204, body: "" }
              : { status: 200, body: pageBody },
      });
      const reply = await h.clipboard({ clipboard_operation: "list", search: "合成" });
      check(reply.ok === true, "the listing succeeds");
      check(
        JSON.stringify(reply.value) === JSON.stringify(LIST_VIEW),
        "the value is the driver's list result unchanged",
      );
      const start = h.inputs[0];
      check(
        JSON.stringify(start) ===
          JSON.stringify({
            start: { op: "list", search: "合成" },
            keystore: null,
            device_name: "Synthetic Phone",
          }),
        "the driver starts the list with the search, no keystore yet and the device name",
      );
      check(
        JSON.stringify(h.inputs[1]) ===
          JSON.stringify({
            resume: { n: 1 },
            response: {
              status: 200,
              body: '{"enabled":true,"key_id":null,"wrap":null,"devices":[]}',
            },
          }),
        "the response goes back with the state the driver gave",
      );
      check(
        JSON.stringify(h.inputs[2]) ===
          JSON.stringify({ resume: { n: 2 }, response: { status: 204, body: "" } }),
        "an empty 204 goes back as it is",
      );
      check(
        JSON.stringify(h.events) ===
          JSON.stringify([
            "drive start",
            "save v1.fresh",
            `GET ${KEYS_PATH}`,
            "drive resume",
            `PUT /v1/users/me/clipboard/devices/${OWN}`,
            "drive resume",
            "save v1.fresh.key",
            "GET /v1/users/me/clipboard",
            "drive resume",
          ]),
        `a new keystore is saved before the next request and only when it changes: ${h.events.join(" | ")}`,
      );
      check(
        h.calls.every((call) => call.token === ACCESS),
        "every request carries the account token",
      );
      check(
        h.calls[1].body?.public_key === "p" && h.calls[1].body?.name === "Synthetic Phone",
        "the driver's JSON body reaches the transport",
      );
      check(
        !h.calls.some((call) => call.path.includes("?q=")),
        "the service is never asked to search",
      );
      check(h.disk.keystore === "v1.fresh.key", "the last keystore is the saved one");
    },
  );

  await group(
    "a non-2xx answer goes to the driver and its error code reaches the caller unchanged",
    async () => {
      const conflict = '{"error":{"code":"clipboard_key_conflict","message":"x"}}';
      const h = harness({
        keystore: "v1.saved",
        outputs: [
          request(
            "POST",
            "/v1/users/me/clipboard",
            { ciphertext: "v1.sealed", key_id: "k", dedup: "h" },
            { n: 1 },
            "v1.saved",
          ),
          failed(409, "clipboard_key_conflict", "v1.saved"),
        ],
        respond: () => ({ status: 409, body: conflict }),
      });
      const reply = await h.clipboard({ clipboard_operation: "add", text: "第一行\n第二行" });
      check(
        reply.ok === false && reply.error === "clipboard_key_conflict",
        `the driver's code is the error: ${JSON.stringify(reply)}`,
      );
      check(
        JSON.stringify(h.inputs[0].start as Json) ===
          JSON.stringify({ op: "add", text: "第一行\n第二行" }),
        "the text goes to the driver with its line break, not to the service",
      );
      check(
        JSON.stringify(h.inputs[1].response) === JSON.stringify({ status: 409, body: conflict }),
        "the 409 and its body are handed back rather than mapped",
      );
      check(
        !h.events.some((event) => event.startsWith("save")),
        "an unchanged keystore is not rewritten",
      );
      check(h.calls[0].body?.text === undefined, "no plaintext field reaches the transport");
    },
  );

  await group(
    "a disabled clipboard's 403 is the driver's to read, not a token refresh",
    async () => {
      const disabled = '{"error":{"code":"clipboard_sync_disabled","message":"x"}}';
      const h = harness({
        keystore: "v1.saved",
        outputs: [
          request(
            "POST",
            "/v1/users/me/clipboard/keys",
            { previous_key_id: null },
            { n: 1 },
            "v1.saved",
          ),
          failed(403, "clipboard_sync_disabled", "v1.saved"),
        ],
        respond: () => ({ status: 403, body: disabled }),
      });
      const reply = await h.clipboard({ clipboard_operation: "reset" });
      check(reply.error === "clipboard_sync_disabled", "the code reaches the page");
      check(!h.calls.some((call) => call.path === "/v1/auth/refresh"), "no refresh is attempted");
      check(
        h.disk.session !== null && h.disk.keystore === "v1.saved",
        "the user stays signed in with the keystore",
      );
      check(
        JSON.stringify(h.inputs[1].response) === JSON.stringify({ status: 403, body: disabled }),
        "the driver sees the 403",
      );
    },
  );

  await group(
    "a transport failure is reported as before and never handed to the driver",
    async () => {
      const h = harness({
        keystore: "v1.saved",
        outputs: [request("GET", KEYS_PATH, null, { n: 1 }, "v1.saved")],
        respond: () => {
          throw new Error("account_unavailable");
        },
      });
      const reply = await h.clipboard({ clipboard_operation: "list", search: "" });
      check(reply.error === "account_unavailable", "the transport's failure is the answer");
      check(h.inputs.length === 1, "the driver is not resumed");
    },
  );

  await group("the keyboard's upload stops at a pending device and says so", async () => {
    const h = harness({
      keystore: "v1.saved",
      outputs: [
        request("GET", KEYS_PATH, null, { n: 1 }, "v1.saved"),
        failed(0, "clipboard_device_pending", "v1.saved"),
      ],
      respond: () => ({
        status: 200,
        body: '{"enabled":true,"key_id":"k","wrap":null,"devices":[]}',
      }),
    });
    const reply = await h.bridge.addClipboardForCurrentSession("合成的剪贴板文字");
    check(JSON.parse(reply).error === "clipboard_device_pending", "the pending code comes back");
    check(
      CloudClipboardPolicy.parseSend(reply) === CloudClipboardSendOutcome.PENDING,
      "and the keyboard reads it as waiting for approval",
    );
    check(!h.calls.some((call) => call.method === "POST"), "nothing is uploaded");
  });

  await group("device management maps the panel's operations onto the driver's", async () => {
    const cases: [Json, Json][] = [
      [{ clipboard_operation: "devices" }, { op: "status" }],
      [
        { clipboard_operation: "approve", device_id: OTHER },
        { op: "approve", device_id: OTHER },
      ],
      [
        { clipboard_operation: "reject", device_id: OTHER },
        { op: "reject", device_id: OTHER },
      ],
      [
        { clipboard_operation: "remove", device_id: OTHER },
        { op: "remove", device_id: OTHER },
      ],
      [{ clipboard_operation: "reset" }, { op: "reset" }],
    ];
    for (const [action, operation] of cases) {
      const h = harness({
        keystore: "v1.saved",
        outputs: [done(STATUS_VIEW, "v1.saved")],
        respond: () => ({ status: 500, body: "" }),
      });
      const reply = await h.clipboard(action);
      check(
        JSON.stringify(h.inputs[0].start) === JSON.stringify(operation),
        `${String(action.clipboard_operation)} starts ${JSON.stringify(operation)}`,
      );
      check(
        JSON.stringify(reply.value) === JSON.stringify(STATUS_VIEW),
        `${String(action.clipboard_operation)} answers the status shape`,
      );
    }
    for (const deviceId of [undefined, "", "../keys", "D".repeat(32), "d".repeat(31), 42]) {
      const h = harness({ outputs: [], respond: () => ({ status: 200, body: "{}" }) });
      const reply = await h.clipboard({ clipboard_operation: "approve", device_id: deviceId });
      check(
        reply.error === "account_invalid" && h.inputs.length === 0,
        `a malformed device id is refused locally: ${String(deviceId)}`,
      );
    }
  });

  await group("the driver's refusals and malformed steps are failures, not loops", async () => {
    const refused = harness({
      outputs: [{ ok: false, error: "invalid cloud clipboard e2e request" }],
      respond: () => ({ status: 200, body: "{}" }),
    });
    check(
      (await refused.clipboard({ clipboard_operation: "devices" })).error === "account_unavailable",
      "a native refusal is unavailable",
    );
    const endless: Json[] = Array.from({ length: 40 }, (_unused, index) =>
      request("GET", KEYS_PATH, null, { n: index }, "v1.saved"),
    );
    const looping = harness({
      keystore: "v1.saved",
      outputs: endless,
      respond: () => ({ status: 200, body: "{}" }),
    });
    check(
      (await looping.clipboard({ clipboard_operation: "devices" })).error === "account_unavailable",
      "a driver that never finishes is cut off",
    );
    check(looping.calls.length === 24, `at a fixed number of round trips: ${looping.calls.length}`);
    const elsewhere = harness({
      keystore: "v1.saved",
      outputs: [request("GET", "/v1/users/me", null, { n: 1 }, "v1.saved")],
      respond: () => ({ status: 200, body: "{}" }),
    });
    check(
      (await elsewhere.clipboard({ clipboard_operation: "devices" })).error ===
        "account_unavailable",
      "a path outside the clipboard API is refused",
    );
    check(elsewhere.calls.length === 0, "and never carries the token");
    check(
      parseClipboardDriverStep('{"ok":true,"value":{"done":{},"keystore":""}}') === null,
      "an empty keystore is malformed",
    );
    check(
      parseClipboardDriverStep(
        '{"ok":true,"value":{"error":{"status":0,"code":"Bad Code"},"keystore":"v1.x"}}',
      ) === null,
      "an error code that is not an identifier is malformed",
    );
    for (const code of ["http_500", "Rate-Limited", "clipboard_device_pending"]) {
      check(
        parseClipboardDriverStep(
          JSON.stringify({ ok: true, value: { error: { status: 0, code }, keystore: "v1.x" } }),
        )?.error === code,
        `every identifier the driver accepts is kept: ${code}`,
      );
    }
  });

  await group("a page too large for the driver is refused before it is handed over", async () => {
    const h = harness({
      keystore: "v1.saved",
      outputs: [request("GET", "/v1/users/me/clipboard", null, { n: 1 }, "v1.saved")],
      respond: () => ({ status: 200, body: "x".repeat(1536 * 1024 + 1) }),
    });
    check(
      (await h.clipboard({ clipboard_operation: "list", search: "" })).error ===
        "account_unavailable",
      "an oversized body fails",
    );
    check(h.inputs.length === 1, "the driver never sees it");
    const fits = harness({
      keystore: "v1.saved",
      outputs: [
        request("GET", "/v1/users/me/clipboard", null, { n: 1 }, "v1.saved"),
        done(LIST_VIEW, "v1.saved"),
      ],
      respond: () => ({ status: 200, body: "x".repeat(50 * 16 * 1024 + 64 * 1024) }),
    });
    check(
      (await fits.clipboard({ clipboard_operation: "list", search: "" })).ok === true,
      "fifty full items and their fields fit",
    );
  });

  await group(
    "a sign-out while a request is out stops the operation and keeps the keystore deleted",
    async () => {
      const h = harness({
        outputs: [
          request("GET", KEYS_PATH, null, { n: 1 }, "v1.fresh"),
          request(
            "PUT",
            `/v1/users/me/clipboard/devices/${OWN}`,
            { public_key: "p", name: "n" },
            { n: 2 },
            "v1.fresh.later",
          ),
        ],
        respond: (_call, disk) => {
          // 另一个进程在请求途中退出登录：会话和密钥串都删了。
          disk.session = null;
          disk.keystore = null;
          return { status: 200, body: "{}" };
        },
      });
      const reply = await h.clipboard({ clipboard_operation: "list", search: "" });
      check(
        reply.error === "account_cancelled",
        `the operation is cancelled: ${JSON.stringify(reply)}`,
      );
      check(h.disk.keystore === null, "the deleted keystore is not written back");
    },
  );

  await group(
    "without the native driver the clipboard is unavailable rather than plaintext",
    async () => {
      const h = harness({
        withoutHost: true,
        outputs: [],
        respond: () => ({ status: 200, body: '{"enabled":true,"items":[]}' }),
      });
      check(
        (await h.clipboard({ clipboard_operation: "list", search: "" })).error ===
          "account_unavailable",
        "no listing",
      );
      check(
        (await h.clipboard({ clipboard_operation: "add", text: "合成" })).error ===
          "account_unavailable",
        "no upload",
      );
      check(h.calls.length === 0, "nothing reaches the service");
    },
  );

  await group("signed out, the driver is not started and no device identity is made", async () => {
    const h = harness({ session: null, outputs: [], respond: () => ({ status: 200, body: "{}" }) });
    check(
      (await h.clipboard({ clipboard_operation: "list", search: "" })).error ===
        "account_unauthorized",
      "signed out",
    );
    check(h.inputs.length === 0 && h.disk.keystore === null, "no keystore is generated");
  });

  await group("delete and set_enabled still call the service directly", async () => {
    const h = harness({
      keystore: "v1.saved",
      outputs: [],
      respond: () => ({ status: 204, body: "" }),
    });
    check(
      (await h.clipboard({ clipboard_operation: "delete", id: "c".repeat(64) })).ok === true,
      "delete succeeds",
    );
    check(
      (await h.clipboard({ clipboard_operation: "set_enabled", enabled: false })).ok === true,
      "set_enabled succeeds",
    );
    check(h.inputs.length === 0, "neither goes through the driver");
    check(
      h.calls[0].path === `/v1/users/me/clipboard/${"c".repeat(64)}` &&
        h.calls[1].path === "/v1/users/me/clipboard/settings",
      "they use the unchanged endpoints",
    );
  });

  await group("every way out of the session deletes the keystore with it", async () => {
    const loggedOut = harness({
      keystore: "v1.saved",
      outputs: [],
      respond: () => ({ status: 204, body: "" }),
    });
    await loggedOut.bridge.handle('{"operation":"logout","all":false}');
    check(loggedOut.disk.session === null && loggedOut.disk.keystore === null, "logout");

    const deleted = harness({
      keystore: "v1.saved",
      outputs: [],
      respond: () => ({ status: 204, body: "" }),
    });
    await deleted.bridge.handle('{"operation":"delete_account"}');
    check(deleted.disk.session === null && deleted.disk.keystore === null, "account deletion");

    const expired = harness({
      keystore: "v1.saved",
      outputs: [],
      respond: () => ({ status: 204, body: "" }),
    });
    await expired.bridge.handle('{"operation":"clear_expired"}');
    check(
      expired.disk.session === null && expired.disk.keystore === null,
      "clearing an expired session",
    );

    const refused = harness({
      keystore: "v1.saved",
      session: session("synthetic-user", "b", Date.now() - 1),
      outputs: [],
      respond: () => ({ status: 401, body: "" }),
    });
    await refused.bridge.handle('{"operation":"profile"}');
    check(refused.disk.session === null && refused.disk.keystore === null, "a refused refresh");

    const corrupt = harness({
      keystore: "v1.saved",
      session: "{not json",
      outputs: [],
      respond: () => ({ status: 200, body: "{}" }),
    });
    check(
      corrupt.disk.session === null && corrupt.disk.keystore === null,
      "an unreadable session document",
    );
  });

  await group(
    "signing in as another account starts a new device identity, the same account keeps it",
    async () => {
      const login = (id: string) => () => ({
        status: 200,
        body: JSON.stringify({
          access_token: "7".repeat(64),
          refresh_token: "8".repeat(64),
          token_type: "Bearer",
          expires_in: 900,
          user: { id, display_name: "Synthetic", created_at: "2026-01-01" },
        }),
      });
      const switched = harness({
        keystore: "v1.saved",
        outputs: [],
        respond: login("another-user"),
      });
      await switched.bridge.handle(
        '{"operation":"login","challenge_id":"challenge","credential":"123456"}',
      );
      check(switched.disk.keystore === null, "another account does not inherit the keystore");
      const same = harness({ keystore: "v1.saved", outputs: [], respond: login("synthetic-user") });
      await same.bridge.handle(
        '{"operation":"login","challenge_id":"challenge","credential":"123456"}',
      );
      check(same.disk.keystore === "v1.saved", "the same account keeps its approval");
    },
  );

  console.log("");
  if (failures > 0) {
    throw new Error(`${failures} group(s) failed`);
  }
  console.log(`all groups passed (${checks} assertions)`);
}

void main();
