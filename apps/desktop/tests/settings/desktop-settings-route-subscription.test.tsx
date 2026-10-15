// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { HostCapabilities, SettingsClient } from "@msime/ui";
import { testHost } from "../support/host";

const bridge = vi.hoisted(() => ({
  native: true,
  entry: undefined as ReactNode,
  invoke: vi.fn<(command: string) => Promise<unknown>>(),
  listen:
    vi.fn<(name: string, listener: (event: { payload: string }) => void) => Promise<() => void>>(),
  stop: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: bridge.invoke,
  isTauri: () => bridge.native,
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: bridge.listen }));
vi.mock("@msime/ui/styles.css", () => ({}));
vi.mock("react-dom/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-dom/client")>();
  return {
    ...original,
    createRoot: (...args: Parameters<typeof original.createRoot>) =>
      args[0] === document.getElementById("root")
        ? { render: (entry: ReactNode) => (bridge.entry = entry) }
        : original.createRoot(...args),
  };
});
vi.mock("@msime/ui", async (importOriginal) => {
  const original = await importOriginal<typeof import("@msime/ui")>();
  return {
    ...original,
    SettingsStartupPage: () => <div data-testid="startup" />,
    SettingsPage: ({
      client,
      initialPage,
      route,
    }: {
      client: SettingsClient;
      initialPage?: string;
      route?: { page: string; nonce: number };
    }) => (
      <div
        data-testid="settings"
        data-platform={client.host?.platform ?? ""}
        data-initial-page={initialPage ?? ""}
        data-route={route?.page ?? ""}
        data-nonce={route?.nonce ?? 0}
      />
    ),
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

const nativeInvoke = async (command: string) => {
  if (command === "supports_font_catalog") return false;
  if (command === "initial_settings_page") return "dictionary";
  if (command === "host_capabilities") return testHost({ platform: "windows" });
  throw new Error(`unexpected synthetic command: ${command}`);
};

beforeAll(async () => {
  const root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);
  await import("../../src/main");
});

beforeEach(() => {
  vi.clearAllMocks();
  bridge.native = true;
  bridge.invoke.mockImplementation(nativeInvoke);
  bridge.listen.mockResolvedValue(bridge.stop);
});

afterEach(cleanup);
afterAll(() => document.getElementById("root")?.remove());

function mount(strict = false) {
  const entry = bridge.entry as ReactElement<{ children: ReactNode }>;
  return render(strict ? entry : entry.props.children);
}

test("registers routing immediately and forwards nonempty repeated requests", async () => {
  const host = deferred<HostCapabilities>();
  const page = deferred<string>();
  bridge.invoke.mockImplementation((command) =>
    command === "host_capabilities"
      ? host.promise
      : command === "initial_settings_page"
        ? page.promise
        : nativeInvoke(command),
  );
  const view = mount();
  expect(bridge.listen).toHaveBeenCalledOnce();
  expect(bridge.listen).toHaveBeenCalledWith("settings-route", expect.any(Function));
  expect(screen.getByTestId("startup")).toBeTruthy();
  await act(async () => {
    host.resolve(testHost({ platform: "windows" }));
    page.resolve("dictionary");
  });
  const settings = await screen.findByTestId("settings");
  expect(settings.getAttribute("data-initial-page")).toBe("dictionary");
  const emit = bridge.listen.mock.calls[0][1];
  act(() => emit({ payload: "voice" }));
  expect(settings.getAttribute("data-route")).toBe("voice");
  expect(settings.getAttribute("data-nonce")).toBe("1");
  act(() => emit({ payload: "" }));
  expect(settings.getAttribute("data-route")).toBe("voice");
  expect(settings.getAttribute("data-nonce")).toBe("1");
  act(() => emit({ payload: "voice" }));
  expect(settings.getAttribute("data-nonce")).toBe("2");
  view.unmount();
  expect(bridge.stop).toHaveBeenCalledOnce();
});

test("releases a registration that arrives after the entry unmounts", async () => {
  const registration = deferred<() => void>();
  bridge.listen.mockReturnValue(registration.promise);
  const view = mount();
  await screen.findByTestId("settings");
  view.unmount();
  await act(async () => registration.resolve(bridge.stop));
  expect(bridge.stop).toHaveBeenCalledOnce();
});

test("StrictMode ignores the old listener and releases both registrations", async () => {
  const registration = deferred<() => void>();
  const oldStop = vi.fn();
  bridge.listen.mockReturnValueOnce(registration.promise);
  const view = mount(true);
  const settings = await screen.findByTestId("settings");
  expect(bridge.listen).toHaveBeenCalledTimes(2);
  const stale = bridge.listen.mock.calls[0][1];
  const current = bridge.listen.mock.calls[1][1];
  act(() => stale({ payload: "voice" }));
  expect(settings.getAttribute("data-route")).toBe("");
  act(() => current({ payload: "appearance" }));
  expect(settings.getAttribute("data-route")).toBe("appearance");
  expect(settings.getAttribute("data-nonce")).toBe("1");
  await act(async () => registration.resolve(oldStop));
  expect(oldStop).toHaveBeenCalledOnce();
  expect(bridge.stop).not.toHaveBeenCalled();
  view.unmount();
  expect(bridge.stop).toHaveBeenCalledOnce();
});

test("continues host initialization when routing registration rejects", async () => {
  bridge.listen.mockRejectedValue(new Error("synthetic registration failure"));
  mount();
  const settings = await screen.findByTestId("settings");
  expect(settings.getAttribute("data-platform")).toBe("windows");
  expect(settings.getAttribute("data-initial-page")).toBe("dictionary");
  expect(bridge.stop).not.toHaveBeenCalled();
});

test("does not continue bootstrap discovery after unmount", async () => {
  const host = deferred<HostCapabilities>();
  bridge.invoke.mockImplementation((command) =>
    command === "host_capabilities" ? host.promise : nativeInvoke(command),
  );
  const view = mount();
  view.unmount();
  await act(async () => host.resolve(testHost({ platform: "android" })));
  expect(bridge.invoke.mock.calls.map(([command]) => command)).not.toContain(
    "android_bootstrap_status",
  );
  expect(bridge.stop).toHaveBeenCalledOnce();
});

test("browser initialization does not register a native listener", async () => {
  bridge.native = false;
  mount();
  const settings = await screen.findByTestId("settings");
  expect(settings.getAttribute("data-platform")).toBe("");
  expect(bridge.listen).not.toHaveBeenCalled();
  expect(bridge.invoke).not.toHaveBeenCalled();
});
