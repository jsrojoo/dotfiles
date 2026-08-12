import subprocess


def get_current_session_name():
    command = "tmux display-message -p '#S'".split(" ")

    result = subprocess.run(command, capture_output=True, text=True)

    current_session_name = result.stdout.replace("'", "")

    return current_session_name
