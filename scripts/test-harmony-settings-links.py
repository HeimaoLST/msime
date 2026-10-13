#!/usr/bin/env python3
"""The HarmonyOS keyboard and the settings page agree on which settings pages the keyboard may open.

The keyboard asks for a page by putting its id in the Want that starts the settings ability. Two lists decide whether the request gets through: `SettingsPageLink.PAGES`, which the keyboard and `EntryAbility` share, and `LINKED_PAGES` in apps/harmony/src/main.tsx, which the page checks before it navigates. A page that is in the first and not the second is silently dropped by the page: the keyboard's 「更多皮肤」 tile closed its panel and then nothing happened, because `skin` had been added to one list only.

Both lists are read here as literal string arrays and compared as sets, and every id has to be a page the shared settings registry knows.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
KEYBOARD = ROOT / "platforms" / "harmony" / "entry" / "src" / "main" / "ets" / "keyboard" / "SettingsPageLink.ts"
PAGE = ROOT / "apps" / "harmony" / "src" / "main.tsx"
REGISTRY = ROOT / "packages" / "ui" / "src" / "settings" / "settings-page-registry.ts"


def string_array(path: pathlib.Path, declaration: str) -> list[str] | None:
    match = re.search(declaration + r"[^=]*=\s*\[([^\]]*)\]", path.read_text(encoding="utf-8"))
    if match is None:
        return None
    return re.findall(r"""["']([^"']+)["']""", match.group(1))


def main() -> int:
    if not KEYBOARD.is_file() or not PAGE.is_file():
        print("harmony settings links: no HarmonyOS sources, skipped")
        return 0
    keyboard = string_array(KEYBOARD, r"static readonly PAGES")
    page = string_array(PAGE, r"const LINKED_PAGES")
    if keyboard is None or page is None:
        print("harmony settings links: could not find SettingsPageLink.PAGES or LINKED_PAGES")
        return 1
    findings = []
    if set(keyboard) != set(page):
        findings.append(f"SettingsPageLink.PAGES {sorted(keyboard)} and LINKED_PAGES {sorted(page)} differ; a page in only one of them is dropped")
    known = set(re.findall(r'id: "([^"]+)"', REGISTRY.read_text(encoding="utf-8")))
    unknown = sorted(set(keyboard) - known)
    if unknown:
        findings.append(f"not settings pages: {unknown}")
    if findings:
        print("\n".join(findings))
        return 1
    print(f"harmony settings links: the keyboard and the page both link {sorted(keyboard)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
