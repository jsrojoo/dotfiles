import subprocess
import tempfile
import os

SESSION_NAME = "session_name"
WINDOW_NAME = "window_name"
WINDOW_INDEX = "window_index"
PANE_COMMAND = "pane_command"

FORMAT_MAP = {
    SESSION_NAME: "#S",
    WINDOW_NAME: "#W",
    WINDOW_INDEX: "#{window_index}",
    PANE_COMMAND: "#{pane_current_command}",
}

format_values = [FORMAT_MAP[key] for key in FORMAT_MAP]

list_sessions_format = ":".join(format_values)


tmux_sessions_command = f"tmux lsw -a -F '{list_sessions_format}'"

tmux_list_sessions_result = subprocess.run(
    tmux_sessions_command.split(" "),
    capture_output=True,
    text=True,
)

# sessions = [
#     session for session in tmux_list_sessions_result.stdout.split("\n") if session
# ]
#
with tempfile.NamedTemporaryFile(delete=False) as sessions_file:
    sessions_file.write(tmux_list_sessions_result.stdout.encode("utf-8"))
    sessions_file.flush()

os.system(f"fzf < {sessions_file.name}")


# for session in sessions:
#     (
#         session_name,
#         window_name,
#         window_index,
#         command,
#     ) = session.split(":")
