import os
import subprocess


def create_or_switch_session(dir_name, start_dir):
    _clean_dir_name = dir_name.strip()
    _clean_start_dir = start_dir.strip()

    tmux_ls_result = subprocess.run(
        "tmux ls -F '#S'".split(" "),
        capture_output=True,
        text=True,
    )

    list_sessions_result = tmux_ls_result.stdout

    if not list_sessions_result:
        os.system(f'tmux new-session -c "{_clean_start_dir}" -s "{_clean_dir_name}"')
        exit()

    sessions = list_sessions_result.replace("'", "").split("\n")

    clean_sessions = [session.strip() for session in sessions if session]

    if _clean_dir_name in clean_sessions:
        os.system(
            f'tmux switch -t "{_clean_dir_name}" || tmux a -t "{_clean_dir_name}"'
        )
        exit()

    # Creating new sessions based on directories from zoxide
    tmux_create_session_command = (
        f'tmux new-session -s "{_clean_dir_name}" -c {_clean_start_dir} -d'
    )

    os.system(tmux_create_session_command)
    os.system(f'tmux switch -t "{_clean_dir_name}"')
    exit()
