"""Small ctypes helpers for Host API JSON responses."""

import ctypes
import json


class ResponseDecoder:
    """Decode and release a response allocated by the Host API."""

    def __init__(self, library):
        self.library = library
        self.library.msime_client_string_free.argtypes = [ctypes.c_void_p]
        self.library.msime_client_string_free.restype = None

    def decode(self, pointer):
        if not pointer:
            raise AssertionError("Missing native response")
        try:
            return json.loads(ctypes.string_at(pointer).decode("utf-8"))
        finally:
            self.library.msime_client_string_free(pointer)

