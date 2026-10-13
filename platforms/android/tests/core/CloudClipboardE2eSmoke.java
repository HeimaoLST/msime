package app.msime.android;

import java.util.ArrayList;
import java.util.List;

/** 云剪贴板端到端驱动的宿主循环：保存密钥串的时机、任意状态码交回驱动、错误码原样交出、两个进程同时生成身份时只留一个。 */
public final class CloudClipboardE2eSmoke {
    private static final String IDENTITY_A = "v1." + "A".repeat(43);
    private static final String IDENTITY_B = "v1." + "B".repeat(43);
    private static final String KEYED_A = IDENTITY_A + "." + "0".repeat(32) + "." + "C".repeat(43);
    private static final String PATH = "/v1/users/me/clipboard";

    public static void main(String[] args) throws Exception {
        persistsBeforeTheNextRequest();
        handsEveryStatusToTheDriver();
        preservesTheDriverErrorCode();
        transportFailuresAreNotResponses();
        aLosingIdentityRestartsBeforeAnyRequest();
        anIdentityChangeAfterARequestFails();
        theGuardRunsBeforeTheFirstWrite();
        refusesRequestsOutsideTheClipboardApi();
        boundsResponsesAndSteps();
        namesTheDevice();
        System.out.println("Android cloud clipboard e2e host loop passed");
    }

    private static void persistsBeforeTheNextRequest() throws Exception {
        List<String> events = new ArrayList<>();
        Script driver = new Script(events,
            CloudClipboardE2e.Step.request("GET", PATH + "/keys?device_id=" + "a".repeat(32), null, "{}", IDENTITY_A),
            CloudClipboardE2e.Step.request("PUT", PATH + "/devices/" + "a".repeat(32), "{\"name\":\"x\"}", "{}", IDENTITY_A),
            CloudClipboardE2e.Step.done("{\"ok\":1}", KEYED_A));
        Store store = new Store(events, null);
        String result = CloudClipboardE2e.run(new CloudClipboardE2e.Local(driver, store, "Synthetic Phone"),
            CloudClipboardE2e.Operation.status(), transport(events, 200, ""), () -> events.add("guard"));
        check("{\"ok\":1}".equals(result), "the driver's result is returned");
        check(events.equals(List.of("start null Synthetic Phone", "guard", "save " + IDENTITY_A,
                "send GET", "resume 200", "send PUT", "resume 200", "guard", "save " + KEYED_A)),
            "a new keystore is saved before the next request, and an unchanged one is not saved again: " + events);
    }

    private static void handsEveryStatusToTheDriver() throws Exception {
        List<String> events = new ArrayList<>();
        Script driver = new Script(events,
            CloudClipboardE2e.Step.request("POST", PATH, "{}", "{}", IDENTITY_A),
            CloudClipboardE2e.Step.done("{}", IDENTITY_A));
        Store store = new Store(events, IDENTITY_A);
        CloudClipboardE2e.run(new CloudClipboardE2e.Local(driver, store, "x"), CloudClipboardE2e.Operation.add("synthetic"),
            transport(events, 409, "{\"error\":{\"code\":\"clipboard_key_conflict\"}}"), null);
        check(events.contains("resume 409"), "a 409 is handed back to the driver instead of thrown");
        check(driver.lastBody.contains("clipboard_key_conflict"), "the error body reaches the driver");
        check(!events.contains("save " + IDENTITY_A), "an unchanged keystore is not rewritten");
    }

    private static void preservesTheDriverErrorCode() throws Exception {
        List<String> events = new ArrayList<>();
        Script driver = new Script(events, CloudClipboardE2e.Step.error(0, "clipboard_device_pending", IDENTITY_A));
        Store store = new Store(events, null);
        try {
            CloudClipboardE2e.run(new CloudClipboardE2e.Local(driver, store, "x"), CloudClipboardE2e.Operation.add("synthetic"),
                transport(events, 200, ""), null);
            throw new AssertionError("a driver error must surface");
        } catch (CloudClipboardE2e.Failure failure) {
            check(failure.status == 0 && "clipboard_device_pending".equals(failure.code), "the driver's status and code are kept");
        }
        check(events.contains("save " + IDENTITY_A), "a failing step's keystore is still saved");
        check(!events.contains("send GET"), "nothing is sent after an error");
    }

    private static void transportFailuresAreNotResponses() throws Exception {
        List<String> events = new ArrayList<>();
        Script driver = new Script(events, CloudClipboardE2e.Step.request("GET", PATH, null, "{}", IDENTITY_A));
        Store store = new Store(events, IDENTITY_A);
        try {
            CloudClipboardE2e.run(new CloudClipboardE2e.Local(driver, store, "x"), CloudClipboardE2e.Operation.list(""),
                (method, path, body) -> { throw new java.io.IOException("offline"); }, null);
            throw new AssertionError("a transport failure must surface");
        } catch (java.io.IOException expected) {
            check(events.stream().noneMatch(event -> event.startsWith("resume")), "a transport failure is not handed to the driver");
        }
    }

    private static void aLosingIdentityRestartsBeforeAnyRequest() throws Exception {
        List<String> events = new ArrayList<>();
        // 本进程读到空，生成了身份 B；另一个进程已经先写进了身份 A。
        Script driver = new Script(events,
            CloudClipboardE2e.Step.request("GET", PATH + "/keys?device_id=" + "b".repeat(32), null, "{}", IDENTITY_B),
            CloudClipboardE2e.Step.request("GET", PATH + "/keys?device_id=" + "a".repeat(32), null, "{}", IDENTITY_A),
            CloudClipboardE2e.Step.done("{}", IDENTITY_A));
        Store store = new Store(events, null);
        store.racer = IDENTITY_A;
        List<String> sentPaths = new ArrayList<>();
        CloudClipboardE2e.run(new CloudClipboardE2e.Local(driver, store, "x"), CloudClipboardE2e.Operation.status(),
            (method, path, body) -> {
                sentPaths.add(path);
                return new CloudClipboardE2e.Reply(200, "{}");
            }, null);
        check(events.contains("start " + IDENTITY_A + " x"), "the run restarts with the identity already stored");
        check(sentPaths.equals(List.of(PATH + "/keys?device_id=" + "a".repeat(32))),
            "no request ever carries the losing identity: " + sentPaths);
        check(IDENTITY_A.equals(store.value), "the stored identity is unchanged");
    }

    private static void anIdentityChangeAfterARequestFails() throws Exception {
        List<String> events = new ArrayList<>();
        Script driver = new Script(events,
            CloudClipboardE2e.Step.request("GET", PATH, null, "{}", IDENTITY_A),
            CloudClipboardE2e.Step.done("{}", KEYED_A));
        Store store = new Store(events, IDENTITY_A);
        try {
            CloudClipboardE2e.run(new CloudClipboardE2e.Local(driver, store, "x"), CloudClipboardE2e.Operation.list(""),
                (method, path, body) -> {
                    // 这次操作期间退出又登录，另一个进程写进了新的身份。
                    store.value = IDENTITY_B;
                    return new CloudClipboardE2e.Reply(200, "{}");
                }, null);
            throw new AssertionError("an identity swapped mid-run must fail");
        } catch (CloudClipboardE2e.Failure failure) {
            check("clipboard_keystore_conflict".equals(failure.code), "a mid-run identity change is a conflict");
        }
        check(IDENTITY_B.equals(store.value), "the newer identity is not overwritten");
    }

    private static void theGuardRunsBeforeTheFirstWrite() throws Exception {
        List<String> events = new ArrayList<>();
        Script driver = new Script(events, CloudClipboardE2e.Step.request("GET", PATH, null, "{}", IDENTITY_A));
        Store store = new Store(events, null);
        try {
            CloudClipboardE2e.run(new CloudClipboardE2e.Local(driver, store, "x"), CloudClipboardE2e.Operation.list(""),
                transport(events, 200, "{}"), () -> { throw new java.util.concurrent.CancellationException("account session changed"); });
            throw new AssertionError("a changed login must stop the run");
        } catch (java.util.concurrent.CancellationException expected) {
            check(store.value == null, "nothing is written for a login that is gone");
            check(!events.contains("send GET"), "nothing is sent for a login that is gone");
        }
    }

    private static void refusesRequestsOutsideTheClipboardApi() throws Exception {
        for (String[] request : new String[][] {
                {"GET", "/v1/users/me"}, {"GET", "/v1/users/me/clipboardx"}, {"PATCH", PATH},
                {"GET", PATH + "/../auth/logout"}, {"GET", "https://example.invalid" + PATH}}) {
            List<String> events = new ArrayList<>();
            Script driver = new Script(events, CloudClipboardE2e.Step.request(request[0], request[1], null, "{}", IDENTITY_A));
            try {
                CloudClipboardE2e.run(new CloudClipboardE2e.Local(driver, new Store(events, IDENTITY_A), "x"),
                    CloudClipboardE2e.Operation.status(), transport(events, 200, "{}"), null);
                throw new AssertionError("a request outside the clipboard API must not be sent: " + request[1]);
            } catch (CloudClipboardE2e.Failure failure) {
                check("invalid_state".equals(failure.code), "an unexpected request is a driver failure");
                check(events.stream().noneMatch(event -> event.startsWith("send")), "nothing is sent for " + request[1]);
            }
        }
        check(CloudClipboardE2e.validRequest("GET", PATH + "/keys?device_id=" + "a".repeat(32)), "the keys request is allowed");
        check(CloudClipboardE2e.validRequest("DELETE", PATH + "/devices/" + "a".repeat(32)), "a device delete is allowed");
    }

    private static void boundsResponsesAndSteps() throws Exception {
        List<String> events = new ArrayList<>();
        Script big = new Script(events, CloudClipboardE2e.Step.request("GET", PATH, null, "{}", IDENTITY_A));
        try {
            CloudClipboardE2e.run(new CloudClipboardE2e.Local(big, new Store(events, IDENTITY_A), "x"),
                CloudClipboardE2e.Operation.list(""),
                transport(events, 200, "x".repeat(CloudClipboardE2e.MAX_RESPONSE_BYTES + 1)), null);
            throw new AssertionError("an oversized response must not reach the driver");
        } catch (CloudClipboardE2e.Failure failure) {
            check("invalid_response".equals(failure.code), "an oversized response is an invalid response");
        }
        check(CloudClipboardE2e.MAX_RESPONSE_BYTES >= 50 * 16_384 + 64 * 1024,
            "a full page of fifty maximum-size ciphertexts fits");
        check(CloudClipboardE2e.MAX_RESPONSE_BYTES + 64 * 1024 <= NativeClient.CLOUD_CLIPBOARD_E2E_REQUEST_LIMIT,
            "a resumed step carrying the largest response stays within the JNI request limit");
        CloudClipboardE2e.Driver endless = new CloudClipboardE2e.Driver() {
            @Override public CloudClipboardE2e.Step start(CloudClipboardE2e.Operation operation, String keystore, String name) {
                return CloudClipboardE2e.Step.request("GET", PATH, null, "{}", IDENTITY_A);
            }
            @Override public CloudClipboardE2e.Step resume(String state, int status, String body) {
                return CloudClipboardE2e.Step.request("GET", PATH, null, "{}", IDENTITY_A);
            }
        };
        int[] sent = {0};
        try {
            CloudClipboardE2e.run(new CloudClipboardE2e.Local(endless, new Store(new ArrayList<>(), IDENTITY_A), "x"),
                CloudClipboardE2e.Operation.status(), (method, path, body) -> {
                    sent[0]++;
                    return new CloudClipboardE2e.Reply(200, "");
                }, null);
            throw new AssertionError("an endless driver must be stopped");
        } catch (CloudClipboardE2e.Failure failure) {
            check(sent[0] <= CloudClipboardE2e.MAX_STEPS, "the loop stops within its step bound");
        }
        boolean rejected = false;
        try {
            CloudClipboardE2e.Operation.approve("not-a-device");
        } catch (IllegalArgumentException expected) {
            rejected = true;
        }
        check(rejected, "a malformed device id is refused before the driver");
    }

    private static void namesTheDevice() {
        check("Google Pixel 8".equals(CloudClipboardE2e.deviceName("Google", "Pixel 8")), "maker and model");
        check("Xiaomi 23127PN0CC".equals(CloudClipboardE2e.deviceName("Xiaomi", "Xiaomi 23127PN0CC")), "no repeated maker");
        check("Samsung SM-S9180".equals(CloudClipboardE2e.deviceName("samsung", "SM-S9180")), "maker capitalised");
        check("Pixel".equals(CloudClipboardE2e.deviceName("unknown", "Pixel")), "an unknown maker is dropped");
        check("Android 设备".equals(CloudClipboardE2e.deviceName(null, " ")), "a fallback when nothing is known");
        check(CloudClipboardE2e.deviceName("Maker", "M\u0000odel").equals("Maker Model"), "control characters are removed");
        check(CloudClipboardE2e.deviceName("Maker", "x".repeat(100)).length() == 64, "names are bounded to 64 characters");
    }

    private static CloudClipboardE2e.Transport transport(List<String> events, int status, String body) {
        return (method, path, requestBody) -> {
            events.add("send " + method);
            return new CloudClipboardE2e.Reply(status, body);
        };
    }

    /** 按顺序交出预先写好的几步；记下每次 start 带的密钥串和最后交回的正文。 */
    private static final class Script implements CloudClipboardE2e.Driver {
        private final List<String> events;
        private final List<CloudClipboardE2e.Step> steps;
        String lastBody = "";
        private int next;

        Script(List<String> events, CloudClipboardE2e.Step... steps) {
            this.events = events;
            this.steps = List.of(steps);
        }

        @Override public CloudClipboardE2e.Step start(CloudClipboardE2e.Operation operation, String keystore, String name) {
            events.add("start " + keystore + " " + name);
            return take();
        }

        @Override public CloudClipboardE2e.Step resume(String state, int status, String body) {
            events.add("resume " + status);
            lastBody = body;
            return take();
        }

        private CloudClipboardE2e.Step take() {
            return steps.get(next++);
        }
    }

    /** 内存里的密钥串，规则与 {@link CloudClipboardKeystore} 相同：已有另一个身份时拒绝。`racer` 模拟另一个进程抢先写进的身份。 */
    private static final class Store implements CloudClipboardE2e.Keystore {
        private final List<String> events;
        String value;
        String racer;

        Store(List<String> events, String value) {
            this.events = events;
            this.value = value;
        }

        @Override public String load() { return value; }

        @Override public void save(String next, CloudClipboardE2e.Guard guard) throws Exception {
            if (racer != null) {
                value = racer;
                racer = null;
            }
            if (value != null && !CloudClipboardKeystore.identity(value).equals(CloudClipboardKeystore.identity(next)))
                throw new CloudClipboardE2e.IdentityConflict(value);
            if (guard != null) guard.check();
            events.add("save " + next);
            value = next;
        }

        @Override public void delete() { value = null; }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
