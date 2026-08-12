import os
import subprocess


def ensure_session_windows(session_name, start_dir, window_names):
    list_windows_result = subprocess.run(
        ["tmux", "list-windows", "-t", session_name, "-F", "#W"],
        capture_output=True,
        text=True,
        check=False,
    )

    if list_windows_result.returncode != 0:
        return

    windows = {
        name.strip() for name in list_windows_result.stdout.split("\n") if name.strip()
    }

    for window_name in window_names:
        if window_name in windows:
            continue
        os.system(
            f'tmux new-window -t "{session_name}" -n "{window_name}" -c "{start_dir}"'
        )


def create_or_switch_session_return(dir_name, start_dir):
    _clean_dir_name = dir_name.strip()
    _clean_start_dir = start_dir.strip()
    window_names = ["codex", "codex-cli", "nvim"]

    tmux_ls_result = subprocess.run(
        "tmux ls -F '#S'".split(" "),
        capture_output=True,
        text=True,
    )

    list_sessions_result = tmux_ls_result.stdout

    if not list_sessions_result:
        os.system(
            f'tmux new-session -s "{_clean_dir_name}" -n "nvim" -c "{_clean_start_dir}" -d'
        )
        ensure_session_windows(_clean_dir_name, _clean_start_dir, window_names)
        os.system(f'tmux switch -t "{_clean_dir_name}"')
        return _clean_dir_name

    sessions = list_sessions_result.replace("'", "").split("\n")

    clean_sessions = [session.strip() for session in sessions if session]

    if _clean_dir_name in clean_sessions:
        os.system(
            f'tmux switch -t "{_clean_dir_name}" || tmux a -t "{_clean_dir_name}"'
        )
        return _clean_dir_name

    # Creating new sessions based on directories from zoxide
    tmux_create_session_command = (
        f'tmux new-session -s "{_clean_dir_name}" -n "nvim" -c {_clean_start_dir} -d'
    )

    os.system(tmux_create_session_command)
    ensure_session_windows(_clean_dir_name, _clean_start_dir, window_names)
    os.system(f'tmux switch -t "{_clean_dir_name}"')
    return _clean_dir_name


def create_or_switch_session(dir_name, start_dir):
    create_or_switch_session_return(dir_name, start_dir)
    exit()
