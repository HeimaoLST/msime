#!/usr/bin/env python3
"""验证分卷恢复、校验值和六平台完整性，不创建 GiB 级测试文件。"""

import hashlib
import importlib.util
from pathlib import Path
import random
import tarfile
import tempfile
import unittest


spec = importlib.util.spec_from_file_location(
    "packaging", Path(__file__).with_name("package-nightly.py"))
packaging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packaging)


class NightlyPackagingTests(unittest.TestCase):
    def test_round_trip(self):
        for limit in (4096, 1024**2):
            with self.subTest(limit=limit), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                source, output = root / "source", root / "dist"
                generator = random.Random(7767)
                expected = {}
                for platform in packaging.PLATFORMS:
                    directory = source / platform / "artifact"
                    directory.mkdir(parents=True)
                    payload = generator.getrandbits(9000 * 8).to_bytes(9000, "little")
                    path = directory / "payload.bin"
                    path.write_bytes(payload)
                    expected[path.relative_to(source).as_posix()] = payload
                packaging.package(source, output, "a" * 40, limit)
                self.assertTrue(all(path.stat().st_size <= limit for path in output.iterdir()))
                for line in (output / "ARCHIVE_SHA256SUMS").read_text().splitlines():
                    digest, name = line.split("  ")
                    self.assertEqual(hashlib.sha256((output / name).read_bytes()).hexdigest(), digest)
                if limit == 4096:
                    self.assertFalse(list(output.glob("*.tar.gz")))
                    self.assertIn("cat msime-nightly-", (output / "README.txt").read_text())
                    for first in sorted(output.glob("*.part000")):
                        archive = first.with_suffix("")
                        archive.write_bytes(b"".join(part.read_bytes() for part in
                                                   sorted(output.glob(archive.name + ".part*"))))
                else:
                    self.assertFalse(list(output.glob("*.part*")))
                archives = list(output.glob("*.tar.gz"))
                self.assertEqual(len(archives), 7)
                for archive in archives:
                    with tarfile.open(archive) as contents:
                        actual = {member.name.removeprefix("./"): contents.extractfile(member).read()
                                  for member in contents.getmembers() if member.isfile()}
                    self.assertTrue(actual)
                    self.assertTrue(all(expected[name] == payload for name, payload in actual.items()))
                    if len(actual) == 6:
                        self.assertEqual(actual, expected)
                for line in (output / "SHA256SUMS").read_text().splitlines():
                    digest, name = line.split("  ")
                    self.assertEqual(hashlib.sha256(expected[name.removeprefix("./")]).hexdigest(), digest)

    def test_missing_platform_and_stale_output(self):
        with tempfile.TemporaryDirectory() as temporary:
            source, output = Path(temporary) / "source", Path(temporary) / "dist"
            with self.assertRaisesRegex(ValueError, "缺少平台产物"):
                packaging.package(source, output, "a" * 40)
            self.assertFalse(output.exists())
            output.mkdir()
            (output / "stale.tar.gz").touch()
            with self.assertRaisesRegex(ValueError, "输出目录必须为空"):
                packaging.package(source, output, "a" * 40)


if __name__ == "__main__":
    unittest.main()
