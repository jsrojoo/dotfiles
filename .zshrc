# Lima BEGIN
# Make sure iptables and mount.fuse3 are available
PATH="$PATH:/usr/sbin:/sbin"
export PATH
# Lima END

set -o vi

alias "v"="nvim"
alias "vrc"="nvim ~/.config/nvim/init.lua"
alias "zrc"="nvim ~/.zshrc"
alias "trc"="nvim ~/.tmux.nvim/init.lua"
alias "t"="nvim -u ~/dotfiles/tmux-nvim.lua"
alias "src"="source ~/.zshrc"
alias "nvenv"="source ~/.config/nvim/nvim-venv/bin/activate"

alias "l"="ls -1"
alias "la"="eza -a"
alias "ll"="eza -l"
alias "lla"="eza -la"
alias "ls"="eza"
alias "lt"="eza --tree"

bindkey -v
bindkey "^R" history-incremental-search-backward

setupHistory () {
  setopt EXTENDED_HISTORY          # Write the history file in the ':start:elapsed;command' format.
  setopt INC_APPEND_HISTORY        # Write to the history file immediately, not when the shell exits.
  setopt SHARE_HISTORY             # Share history between all sessions.
  setopt HIST_EXPIRE_DUPS_FIRST    # Expire a duplicate event first when trimming history.
  setopt HIST_IGNORE_DUPS          # Do not record an event that was just recorded again.
  setopt HIST_IGNORE_ALL_DUPS      # Delete an old recorded event if a new event is a duplicate.
  setopt HIST_FIND_NO_DUPS         # Do not display a previously found event.
  setopt HIST_IGNORE_SPACE         # Do not record an event starting with a space.
  setopt HIST_SAVE_NO_DUPS         # Do not write a duplicate event to the history file.
  setopt HIST_VERIFY               # Do not execute immediately upon history expansion.
  setopt APPEND_HISTORY            # append to history file
  setopt HIST_NO_STORE             # Don't store history commands
}

setupHistory;
