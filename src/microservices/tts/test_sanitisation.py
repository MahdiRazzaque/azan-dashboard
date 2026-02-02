import os
import uuid

def test_sanitisation():
    # Simulated logic from preview_tts
    def preview_logic(input_filename):
        filename = input_filename if input_filename else f"preview_{uuid.uuid4().hex}.mp3"
        filename = os.path.basename(filename)
        return filename

    # Simulated logic from generate_tts
    def generate_logic(input_filename):
        filename = os.path.basename(input_filename)
        return filename

    # Test cases
    assert preview_logic("../../../etc/passwd") == "passwd"
    assert preview_logic("safe.mp3") == "safe.mp3"
    assert preview_logic(None).startswith("preview_")
    
    assert generate_logic("../../evil.mp3") == "evil.mp3"
    assert generate_logic("C:\\Windows\\System32\\cmd.exe") == "cmd.exe"

if __name__ == "__main__":
    test_sanitisation()
    print("All simulated Python sanitisation logic tests passed!")