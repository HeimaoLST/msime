#!/usr/bin/env python3
"""Ensure delayed hardware-keyboard callbacks cannot cross input-service generations."""
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/core/MSIMEInputService.java"


class AndroidInputSessionCallbackLifecycleContract(unittest.TestCase):
    def test_hardware_show_callback_is_fenced_to_its_input_generation(self):
        source = SOURCE.read_text(encoding="utf-8")
        start = source.find("private void noteHardwareTyping()")
        self.assertGreaterEqual(start, 0, "noteHardwareTyping must remain a focused lifecycle boundary")
        end = source.find("\n    /**", start)
        self.assertGreater(end, start, "noteHardwareTyping must be followed by a documented method")
        body = source[start:end]
        self.assertRegex(body, r"long\s+expectedGeneration\s*=\s*engineStartGeneration")
        self.assertRegex(body, r"expectedGeneration\s*!=\s*engineStartGeneration")


if __name__ == "__main__":
    unittest.main()
