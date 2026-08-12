import subprocess


def parse_argument(arguments):
    zoxide_command = 'zoxide query ' + ' '.join(arguments)

    zoxide_query_list_result = subprocess.run(
            zoxide_command.split(' '),
            capture_output=True,
            text=True,
            )

    dir_match = zoxide_query_list_result.stdout

    return dir_match
