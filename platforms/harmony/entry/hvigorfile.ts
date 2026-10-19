import { hapTasks, OhosHapContext, OhosPluginId } from "@ohos/hvigor-ohos-plugin";
import { HvigorNode } from "@ohos/hvigor";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/** The settings page is built by platforms/harmony/stage-settings.sh rather than committed. A HAP without it installs and runs but opens a blank settings window with no error anywhere, so hvigor stops here and says what to run instead. */
function settingsPagePlugin() {
  return {
    pluginId: "msimeSettingsPagePlugin",
    apply(node: { getNodePath(): string }): void {
      const page: string = path.join(
        node.getNodePath(),
        "src",
        "main",
        "resources",
        "rawfile",
        "settings",
        "index.html",
      );
      if (!fs.existsSync(page) || fs.statSync(page).size === 0) {
        throw new Error(
          `${page} is missing: run bash platforms/harmony/stage-settings.sh (after pnpm install at the repository root) before hvigorw.`,
        );
      }
    },
  };
}

const RELEASE_DATE: RegExp = /^\d{4}-\d{2}-\d{2}$/;

/** 「关于」页版本号后面的发布日期 `YYYY-MM-DD`。依次取：构建时的环境变量 `MSIME_RELEASE_DATE`，源码包里与 version.txt 并列的 release-date.txt，构建所在提交的日期（发版从 main 的 release 合并提交构建，就是发版当天）；都没有时为空串，页面只显示版本号。环境变量或文件写错了直接让构建失败，不悄悄换成别的来源。 */
function releaseDate(harmonyRoot: string): string {
  const fromEnv: string = (process.env.MSIME_RELEASE_DATE || "").trim();
  if (fromEnv.length > 0) {
    if (!RELEASE_DATE.test(fromEnv)) {
      throw new Error(`MSIME_RELEASE_DATE must be YYYY-MM-DD, got ${JSON.stringify(fromEnv)}`);
    }
    return fromEnv;
  }
  const file: string = path.join(harmonyRoot, "release-date.txt");
  if (fs.existsSync(file)) {
    const fromFile: string = fs.readFileSync(file, "utf8").trim();
    if (!RELEASE_DATE.test(fromFile)) {
      throw new Error(`${file} must hold one YYYY-MM-DD date, got ${JSON.stringify(fromFile)}`);
    }
    return fromFile;
  }
  try {
    const fromGit: string = execFileSync("git", ["log", "-1", "--format=%cs"], {
      cwd: harmonyRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return RELEASE_DATE.test(fromGit) ? fromGit : "";
  } catch (error) {
    // 没有 git 或不在仓库里（解开的源码包）：不显示日期。
    return "";
  }
}

/** 把发布日期写进生成的 `BuildProfile`（`BuildProfile.RELEASE_DATE`），设置页的 `appReleaseDate()` 从那里读。 */
function releaseDatePlugin() {
  return {
    pluginId: "msimeReleaseDatePlugin",
    apply(node: HvigorNode): void {
      const context = node.getContext(OhosPluginId.OHOS_HAP_PLUGIN) as OhosHapContext;
      const profile = context.getBuildProfileOpt();
      profile.buildOption = profile.buildOption || {};
      profile.buildOption.arkOptions = profile.buildOption.arkOptions || {};
      profile.buildOption.arkOptions.buildProfileFields = {
        ...(profile.buildOption.arkOptions.buildProfileFields || {}),
        RELEASE_DATE: releaseDate(path.dirname(node.getNodePath())),
      };
      context.setBuildProfileOpt(profile);
    },
  };
}

export default {
  system: hapTasks /* Built-in plugin of Hvigor. It cannot be modified. */,
  plugins: [
    settingsPagePlugin(),
    releaseDatePlugin(),
  ] /* Custom plugin to extend the functionality of Hvigor. */,
};
