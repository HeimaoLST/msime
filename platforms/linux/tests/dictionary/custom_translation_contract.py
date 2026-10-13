#!/usr/bin/env python3
"""自定义翻译服务的请求构造：与共享 Rust 实现跑同一组用例，并核对 DeepL 官方 API 的收发。只用合成密钥和合成回复，不联网。"""
import importlib.machinery
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import unittest
import unittest.mock

ROOT = Path(__file__).resolve().parents[2]
REPOSITORY = ROOT.parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def load(name, filename):
    loader = importlib.machinery.SourceFileLoader(name, str(ROOT / "scripts" / filename))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


online = load("custom_translation_online_provider", "msime-linux-online-provider")

DEEPL_REPLY = {"translations": [{"detected_source_language": "ZH", "text": "Test"}]}


class CustomTranslationContract(unittest.TestCase):
    def test_requests_match_the_shared_cases(self):
        # 与 crates/client-core/src/translation.rs 的 custom_translation_request 跑同一组用例。
        contract = json.loads((REPOSITORY / "shared/contracts/custom-translation/cases.json").read_text())
        self.assertGreaterEqual(len(contract["cases"]), 10)
        for case in contract["cases"]:
            with self.subTest(case["name"]):
                self.assertTrue(online.secure_custom_endpoint(case["endpoint"]))
                request = online.custom_translation_request(
                    {"endpoint": case["endpoint"], "api_key": case["api_key"]},
                    case["text"], case["source_language"], case["target_language"])
                actual = None if request is None else {
                    "url": request[0], "headers": request[1], "body": request[2]}
                self.assertEqual(actual, case["request"])

    def test_deepl_reply_becomes_a_gloss(self):
        config = {"endpoint": "https://api.deepl.com/v2/translate", "api_key": "synthetic-key:fx"}
        with unittest.mock.patch.object(online, "fetch", return_value=DEEPL_REPLY) as fetch:
            self.assertEqual(online.custom_translation(config, "测试", "zh", "en", 2.5), "Test")
        url, _, body, token, headers = fetch.call_args[0]
        self.assertEqual(url, "https://api-free.deepl.com/v2/translate")
        self.assertEqual(body, {"text": ["测试"], "source_lang": "ZH", "target_lang": "EN-US"})
        # 不走 fetch 的 Bearer 参数，DeepL 的鉴权头整个由请求构造给出。
        self.assertIsNone(token)
        self.assertEqual(headers["Authorization"], "DeepL-Auth-Key synthetic-key:fx")

    def test_deepl_errors_are_not_glosses(self):
        # 403、456 由 HTTP 子进程报成失败，fetch 抛出异常；safely 把它变成没有译文。
        config = {"endpoint": "https://api-free.deepl.com/v2/translate", "api_key": "synthetic-key:fx"}
        with unittest.mock.patch.object(online, "fetch", side_effect=ValueError("HTTP request failed")):
            self.assertIsNone(online.safely(online.custom_translation, config, "测试", "zh", "en", 2.5))
        for reply in ({"message": "Quota Exceeded"}, {"translations": []}, {"translations": [{"text": ""}]}):
            with unittest.mock.patch.object(online, "fetch", return_value=reply):
                self.assertIsNone(online.custom_translation(config, "测试", "zh", "en", 2.5), reply)

    def test_deepl_without_a_key_sends_nothing(self):
        config = {"endpoint": "https://api-free.deepl.com/v2/translate", "api_key": ""}
        with unittest.mock.patch.object(online, "fetch") as fetch:
            self.assertIsNone(online.custom_translation(config, "测试", "zh", "en", 2.5))
            result = online.credential_test({"service": "translation.custom", "config": config},
                                            SimpleNamespace())
        self.assertFalse(result["ok"])
        fetch.assert_not_called()

    def test_credential_test_reaches_deepl_with_the_trimmed_key(self):
        config = {"endpoint": " https://api-free.deepl.com/v2/translate ", "api_key": " synthetic-key:fx "}
        with unittest.mock.patch.object(online, "fetch", return_value=DEEPL_REPLY) as fetch:
            result = online.credential_test({"service": "translation.custom", "config": config},
                                            SimpleNamespace())
        self.assertTrue(result["ok"])
        url, _, body, token, headers = fetch.call_args[0]
        self.assertEqual(url, "https://api-free.deepl.com/v2/translate")
        self.assertEqual(body["text"], ["hello"])
        self.assertEqual(body["target_lang"], "ZH-HANS")
        self.assertIsNone(token)
        self.assertEqual(headers["Authorization"], "DeepL-Auth-Key synthetic-key:fx")

    def test_deeplx_keeps_its_request_shape(self):
        config = {"endpoint": "https://deeplx.example/translate", "api_key": "synthetic-key"}
        with unittest.mock.patch.object(online, "fetch", return_value={"code": 200, "data": "Test"}) as fetch:
            self.assertEqual(online.custom_translation(config, "测试", "zh", "en", 2.5), "Test")
        url, _, body, token, headers = fetch.call_args[0]
        self.assertEqual(url, "https://deeplx.example/translate")
        self.assertEqual(body, {"text": "测试", "source_lang": "ZH", "target_lang": "EN"})
        self.assertIsNone(token)
        self.assertEqual(headers, {"Content-Type": "application/json", "Authorization": "Bearer synthetic-key"})


if __name__ == "__main__":
    unittest.main()
