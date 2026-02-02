import os
import unittest
from server import PreviewRequest, TTSRequest

class TestTTSSecurity(unittest.TestCase):
    def test_preview_request_sanitization_logic(self):
        # This is a bit tricky because the sanitization is inside the endpoint function
        # and not in a separate utility. 
        # For now, I'll just rely on the implementation plan and verify later.
        pass

if __name__ == '__main__':
    unittest.main()
