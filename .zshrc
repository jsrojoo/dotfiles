set -o vi

alias v="nvim"
alias vrc="nvim ~/.config/nvim/init.lua"
alias zrc="nvim ~/.zshrc"
alias trc="nvim ~/.tmux.nvim/init.lua"
alias t="nvim -u ~/dotfiles/tmux-nvim.lua"
alias src="source ~/.zshrc"
alias nvenv="source ~/.config/nvim/nvim-venv/bin/activate"

bindkey -v
bindkey '^R' history-incremental-search-backward
# Lima BEGIN
# Make sure iptables and mount.fuse3 are available
PATH="$PATH:/usr/sbin:/sbin"
export PATH
# Lima END
