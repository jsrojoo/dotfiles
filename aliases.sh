# general use
alias ls='eza'                                                         # ls
alias l='eza -labF --git'                                              # list, size, type, git
alias ll='eza -lbGF --git'                                             # long list
# alias llm='eza -lbGF --git --sort=modified'                            # long list, modified date sort
alias la='eza -lbhHigUmuSa --time-style=long-iso --git'  # all list
alias lx='eza -lbhHigUmuSa@ --time-style=long-iso --git' # all + extended list

# speciality views
alias lS='eza -1' # one column, just names
alias lt='eza --tree --level=2' # tree

alias -- -="cd -"
alias ~="cd ~"
alias ..="cd .."
alias ...="cd ../.."
alias ....="cd ../../.."
alias .....="cd ../../../.."

alias src='exec zsh'
alias trc='v ~/.tmux.conf'
alias v='nvim'
alias v.='nvim .'
alias vrc='v ~/.config/nvim/init.lua'
alias zrc='v ~/.zshrc'
alias k='kubectl'
alias kk='minikube kubectl --'
alias extract='xtract '
alias xx='xrdb ~/.Xresources'
alias redis="iredis"
alias glab="glab --repo gitlab.scm-emea.aws.fisv.cloud/f1wg9ea/scripts"
alias t="tmuxAlias"
alias tserver="tmux new-window -n server 'mise run g';"
alias tsql="tmux new-window -n pgcli;tmux new-window -n psql;"
alias tfb="tmux new-window -n frontend; tmux new-window -n backend; tmux new-window -n servers; tmux new-window -n codex;"
alias z="zmux"
alias g="mise run g"
alias x="mise run x"

alias gs="git status"
alias gl="git log"
alias gcm="git commit -m"

alias cs="colima start"
alias dcu="docker-compose up -d"
alias today="date '+%Y-%m-%d'"

alias "json-to-yaml"="yq eval -P '.'"
alias "yaml-to-json"="yq eval -o json"

alias "clipboard"="pbcopy"

alias icat="kitty icat"


