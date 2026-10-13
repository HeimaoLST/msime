#!/usr/bin/env python3
"""由 plugins/phrase_table/latex-symbols/symbols.tsv 生成同目录的 pack/plugin.toml（K 模式的短语表包 latex-symbols）。

只用标准库。编码规则：命令名去掉反斜杠和花括号、全部小写（\\mathbb{R} 写成 mathbbr），短语表的编码只能是 1 到 32 个小写字母。只差大小写的命令合到同一个编码下：小写的那一行在前，其余按表里的顺序在后（Kgamma 出 γ、Γ）。生成器在这些情况下失败：

- 编码不是 1 到 32 个小写字母，或者同一个命令名出现两次；
- 码位不是单个非 ASCII 的字符，或者是控制、格式、私用、未分配的码位；
- 同一个编码超过 2 行，或者合并了两行却没有全小写的那一个（例如只有 \\vDash 和 \\VDash）；
- 同一个编码下的两行是同一个字符；
- 总条数不在 250 到 400 之间；
- pack/LICENSE.txt 不是 plugins/phrase_table/LICENSE 的副本。

短语表本身的规则（每个包 1 到 2000 行、文本不含控制字符等）由 msime-pack validate --builtin 核对，scripts/build-official-plugins.sh 会跑它。

usage: gen_latex_symbols.py [--check]
"""
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PACK_DIR = ROOT / "plugins/phrase_table/latex-symbols"
SOURCE = PACK_DIR / "symbols.tsv"
MANIFEST = PACK_DIR / "pack/plugin.toml"
LICENSE = ROOT / "plugins/phrase_table/LICENSE"
LICENSE_COPY = PACK_DIR / "pack/LICENSE.txt"
KEY = re.compile(r"[a-z]{1,32}")
NAME = re.compile(r"\\[A-Za-z]+(\{[A-Za-z]\})?")
CODEPOINT = re.compile(r"U\+([0-9A-F]{4,6})")
MIN_ROWS, MAX_ROWS = 250, 400
# 不收的通用类别：控制、格式、代理、私用、未分配。
REFUSED_CATEGORIES = {"Cc", "Cf", "Cs", "Co", "Cn"}

HEADER = """# 由 plugins/phrase_table/tools/gen_latex_symbols.py 从 symbols.tsv 生成，不要手改。
schema_version = 1
kind = "phrase_table"
id = "latex-symbols"
name = "LaTeX 符号"
version = "1.0.0"
license = "MIT"
description = "在 K 模式里按 LaTeX 的命令名打出符号：Kalpha 出 α，Kinfty 出 ∞，Krightarrow 出 →。命令名去掉反斜杠和花括号、全部小写（\\\\mathbb{R} 写成 mathbbr）；只差大小写的两个命令在同一个编码下，小写的在前（Kgamma 出 γ 和 Γ）。随桌面安装包分发，在插件页启用后才生效。"
"""


def fail(message: str) -> None:
    raise SystemExit(f"gen_latex_symbols: {message}")


def read_rows() -> list[tuple[str, str, str]]:
    """(命令名, 编码, 字符)，按表里的顺序。"""
    rows = []
    names: set[str] = set()
    for number, line in enumerate(SOURCE.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip() or line.startswith("#"):
            continue
        fields = line.split("\t")
        if len(fields) != 2:
            fail(f"symbols.tsv 第 {number} 行必须是「命令名<TAB>U+码位」")
        name, codepoint = fields
        if not NAME.fullmatch(name):
            fail(f"symbols.tsv 第 {number} 行的命令名 {name!r} 不是 \\字母 或 \\字母{{字母}}")
        if name in names:
            fail(f"symbols.tsv 第 {number} 行：{name} 重复了")
        names.add(name)
        key = re.sub(r"[\\{}]", "", name).lower()
        if not KEY.fullmatch(key):
            fail(f"symbols.tsv 第 {number} 行：编码 {key} 不是 1 到 32 个小写字母")
        match = CODEPOINT.fullmatch(codepoint)
        if not match:
            fail(f"symbols.tsv 第 {number} 行的码位 {codepoint!r} 不是 U+XXXX")
        character = chr(int(match.group(1), 16))
        if ord(character) < 0x80 or unicodedata.category(character) in REFUSED_CATEGORIES:
            fail(f"symbols.tsv 第 {number} 行：{codepoint} 是 ASCII、控制、格式、私用或未分配的码位")
        rows.append((name, key, character))
    return rows


def merge(rows: list[tuple[str, str, str]]) -> list[tuple[str, str]]:
    """按编码第一次出现的顺序排开；同一个编码下全小写的命令在前。"""
    groups: dict[str, list[tuple[str, str]]] = {}
    for name, key, character in rows:
        groups.setdefault(key, []).append((name, character))
    merged = []
    for key, entries in groups.items():
        if len(entries) > 2:
            fail(f"编码 {key} 有 {len(entries)} 行（{'、'.join(name for name, _ in entries)}），最多 2 行")
        entries.sort(key=lambda entry: entry[0][1:] != key)
        if len(entries) == 2:
            if entries[0][0][1:] != key:
                fail(f"编码 {key} 合并了 {entries[0][0]} 和 {entries[1][0]}，但没有全小写的那一个")
            if entries[0][1] == entries[1][1]:
                fail(f"编码 {key} 的两行是同一个字符")
        merged.extend((key, character) for _, character in entries)
    if not MIN_ROWS <= len(merged) <= MAX_ROWS:
        fail(f"共 {len(merged)} 条，不在 {MIN_ROWS} 到 {MAX_ROWS} 之间")
    return merged


def render(merged: list[tuple[str, str]]) -> str:
    out = [HEADER]
    for key, character in merged:
        out.append(f'\n[[phrases]]\nkey = "{key}"\ntext = "{character}"\n')
    return "".join(out)


def main(argv: list[str]) -> int:
    check = argv == ["--check"]
    if argv and not check:
        raise SystemExit(__doc__.strip().splitlines()[-1])
    if LICENSE_COPY.read_bytes() != LICENSE.read_bytes():
        fail(f"{LICENSE_COPY.relative_to(ROOT)} 不是 {LICENSE.relative_to(ROOT)} 的副本")
    text = render(merge(read_rows()))
    if check:
        if not MANIFEST.is_file() or MANIFEST.read_text(encoding="utf-8") != text:
            print(f"FAIL: {MANIFEST.relative_to(ROOT)} 和 symbols.tsv 不一致，运行 python3 plugins/phrase_table/tools/gen_latex_symbols.py 重新生成")
            return 1
        print(f"ok: {MANIFEST.relative_to(ROOT)} matches symbols.tsv")
        return 0
    MANIFEST.write_text(text, encoding="utf-8")
    print(f"wrote {MANIFEST.relative_to(ROOT)} ({text.count('[[phrases]]')} phrases)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
