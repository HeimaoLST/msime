#!/usr/bin/env python3
"""检查社区列表同参数重新加载时旧请求不能填充新列表。"""

from pathlib import Path
import unittest


SOURCE = (Path(__file__).resolve().parents[1] / "platforms/android/java/app/msime/android/home/CommunityFragment.java")


class CommunityRequestGenerationContract(unittest.TestCase):
    def test_fresh_request_invalidates_older_request_with_identical_filters(self):
        source = SOURCE.read_text(encoding="utf-8")
        start = source.index("    private void load(boolean fresh)")
        end = source.index("    private String emptyMessage()", start)
        body = source[start:end]
        self.assertIn("long request = ++requestGeneration;", body)
        self.assertIn("if (request != requestGeneration", body)


if __name__ == "__main__":
    unittest.main()
