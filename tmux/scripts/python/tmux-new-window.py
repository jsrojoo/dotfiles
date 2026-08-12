#!/usr/bin/env python3
import os

window_name = input("New Window Name: ")

if not window_name:
    exit()

os.system(f"tmux new-window -n {window_name}")

exit()
