# For loading kubectl completion
autoload bashcompinit && bashcompinit
autoload -Uz compinit; compinit

# Lines configured by zsh-newuser-install
HISTFILE=~/.histfile
HISTSIZE=100000
SAVEHIST=100000

setopt autocd
setopt share_history
setopt inc_append_history
setopt extended_history
setopt hist_find_no_dups
setopt hist_ignore_all_dups

fpath=(~/.zsh/completion $fpath)
fpath=(~/.zsh/zsh-completions/src $fpath)
fpath=(~/.zsh/_fnm $fpath)
fpath+=$HOME/.zsh/pure

autoload -Uz edit-command-line
autoload -Uz vcs_info
autoload -U add-zsh-hook
autoload -U select-word-style
autoload -U promptinit; promptinit

# source <(kubectl completion zsh)

[[ -e ~/.profile ]] && emulate sh -c 'source ~/.profile'
[[ -e ~/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh ]] && source ~/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh
[[ -e ~/.zsh/zsh-command-time/command-time.plugin.zsh ]] && source ~/.zsh/zsh-command-time/command-time.plugin.zsh
[[ -e ~/.zsh/auto-notify.zsh ]] && source ~/.zsh/auto-notify.zsh
[[ -e ~/.zsh/zsh-command-time/command-time.plugin.zsh ]] && source ~/.zsh/zsh-command-time/command-time.plugin.zsh
# [[ -e ~/.zsh/zsh-notify/notify.plugin.zsh ]] && source ~/.zsh/zsh-notify/notify.plugin.zsh

if [[ "$(command -v nvim)" ]]; then
    export EDITOR='nvim'
    export MANPAGER='nvim +Man!'
    export MANWIDTH=999
fi

export PATH="$HOME/.cargo/bin/:$PATH"
export PATH="$HOME/.yarn/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"

export FZF_DEFAULT_OPTS='
--bind ctrl-x:toggle-all,ctrl-n:down,ctrl-e:up
--color=fg:#797593,bg:#faf4ed,hl:#d7827e
--color=fg+:#575279,bg+:#f2e9e1,hl+:#d7827e
--color=border:#dfdad9,header:#286983,gutter:#faf4ed
--color=spinner:#ea9d34,info:#56949f
--color=pointer:#907aa9,marker:#b4637a,prompt:#797593'

## Python PIP zscaler
export CERT_DIR=/etc/ssl/certs
export CERT_PATH=/etc/ssl/certs/zscaler.crt
export NIX_SSL_CERT_FILE=${CERT_PATH} 
export SSL_CERT_FILE=${CERT_PATH} 
export SSL_CERT_DIR=${CERT_DIR}
export REQUESTS_CA_BUNDLE=${CERT_PATH}
export CURL_CA_BUNDLE=${CERT_PATH}
export HTTPLIB2_CA_CERTS=${CERT_PATH}

export NODE_EXTRA_CA_CERTS=${CERT_PATH}
export PYTHONPYCACHEPREFIX="$HOME/.cache/cpython/"
# export HTTP_PROXY=http://fdcproxy.1dc.com:8080
# export HTTPS_PROXY=http://fdcproxy.1dc.com:8080
# export NO_PROXY=http://localhost

# export PYTHONDONTWRITEBYTECODE=1

# CONTAINERS
#
# export DOCKER_HOST=unix:///var/run/docker.sock
# export KUBECONFIG="$HOME/.kube/config"

export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
export PATH="/Applications/Fortify/Fortify_SCA_23.1.1/bin:$PATH"


# for dump in ~/.zcompdump(N.mh+24)
# do
#   compinit
# done
#
# compinit -C
prompt pure
select-word-style bash
precmd() { vcs_info }

zstyle ':completion:*' menu select
zstyle ':vcs_info:git:*' formats '%b'

# 0 -- vanilla completion (abc => abc)
# 1 -- smart case completion (abc => Abc)
# 2 -- word flex completion (abc => A-big-Car)
# 3 -- full flex completion (abc => ABraCadabra)
zstyle ':completion:*' matcher-list '' \
  'm:{a-z\-}={A-Z\_}' \
  'r:[^[:alpha:]]||[[:alpha:]]=** r:|=* m:{a-z\-}={A-Z\_}' \
  'r:|?=** m:{a-z\-}={A-Z\_}'

bindkey -v

# fnm
eval "`fnm env`"

bindkey '^R' history-incremental-search-backward
bindkey '^P' up-history
bindkey '^N' down-history
bindkey '^w' backward-kill-word
bindkey '^a' beginning-of-line
bindkey '^e' end-of-line
bindkey '^ ' autosuggest-accept
bindkey '^?' backward-delete-char

zle -N edit-command-line

bindkey -M vicmd 'v' edit-command-line
bindkey -M vicmd 'n' down-line-or-history
bindkey -M vicmd 'e' up-line-or-history

KEYTIMEOUT=1

function xtract {
  if [ -z "$1" ]; then
    echo "Usage: extract <path/file_name>.<zip|rar|bz2|gz|tar|tbz2|tgz|Z|7z|xz|ex|tar.bz2|tar.gz|tar.xz>"
  else
    if [ -f $1 ]; then
      case $1 in
        *.tar.bz2)   tar xvjf $1    ;;
        *.tar.gz)    tar xvzf $1    ;;
        *.tar.xz)    tar xvJf $1    ;;
        *.lzma)      unlzma $1      ;;
        *.bz2)       bunzip2 $1     ;;
        *.rar)       unrar x -ad $1 ;;
        *.gz)        gunzip $1      ;;
        *.tar)       tar xvf $1     ;;
        *.tbz2)      tar xvjf $1    ;;
        *.tgz)       tar xvzf $1    ;;
        *.zip)       unzip $1       ;;
        *.Z)         uncompress $1  ;;
        *.7z)        7z x $1        ;;
        *.xz)        unxz $1        ;;
        *.exe)       cabextract $1  ;;
        *)           echo "extract: '$1' - unknown archive method" ;;
      esac
    else
      echo "$1 - file does not exist"
    fi
  fi
}

function gitLogAuthors {
  git log --all --format='%aN' | sort -u
}

# use tmux automatically
# if [ -z "$TMUX" ]; then
#     tmux attach -t w || tmux new -s w
# fi

# general use
alias ls='eza'                                                         # ls
alias l='eza -labF --git'                                              # list, size, type, git
alias ll='eza -lbGF --git'                                             # long list
alias llm='eza -lbGF --git --sort=modified'                            # long list, modified date sort
alias la='eza -lbhHigUmuSa --time-style=long-iso --git --color-scale'  # all list
alias lx='eza -lbhHigUmuSa@ --time-style=long-iso --git --color-scale' # all + extended list
#
# speciality views
alias lS='eza -1' # one column, just names
alias lt='eza --tree --level=2' # tree

alias arst="source ~/.xprofile"

alias -- -="cd -"
alias ~="cd ~"
alias ..="cd .."
alias ...="cd ../.."
alias ....="cd ../../.."
alias .....="cd ../../../.."

alias src='exec zsh'
alias t='tmux'
alias trc='v ~/.tmux.conf'
alias v='nvim'
alias vrc='v ~/.config/nvim/init.lua'
alias zrc='v ~/.zshrc'
alias k='kubectl'
alias kk='minikube kubectl --'
alias extract='xtract '
alias xx='xrdb ~/.Xresources'
alias redis="iredis"
alias code="~/Desktop/Visual\ Studio\ Code.app/Contents/Resources/app/bin/code"

alias dots="tmux switch -t dots"
alias dev="tmux switch -t dev"
alias home="tmux switch -t home"

source ~/.fzf.zsh

source ~/dotfiles/scripts.sh

urlencode () {
  printf %s $1 | jq -sRr @uri
}

eval "$(direnv hook zsh)"

export DIRENV_LOG_FORMAT=

eval "$(zoxide init zsh)"

test -e /Users/joseph.rojo/.iterm2_shell_integration.zsh && source /Users/joseph.rojo/.iterm2_shell_integration.zsh || true

eval "$(mise activate zsh)"
