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
fpath+=$HOME/.zsh/pure
fpath=(~/.zsh/zsh-completions/src $fpath)

source <(kubectl completion zsh)

[[ -e ~/.profile ]] && emulate sh -c 'source ~/.profile'
[[ -e ~/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh ]] && source ~/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh
[[ -e ~/.zsh/zsh-z/zsh-z.plugin.zsh ]] && source ~/.zsh/zsh-z/zsh-z.plugin.zsh
[[ -e ~/.zsh/zsh-command-time/command-time.plugin.zsh ]] && source ~/.zsh/zsh-command-time/command-time.plugin.zsh
[[ -e ~/.zsh/auto-notify.zsh ]] && source ~/.zsh/auto-notify.zsh
[[ -e ~/.zsh/fzf-z/fzf-z.plugin.zsh ]] && source ~/.zsh/fzf-z/fzf-z.plugin.zsh

if [[ "$(command -v nvim)" ]]; then
    export EDITOR='nvim'
    export MANPAGER='nvim +Man!'
    export MANWIDTH=999
fi

export FZF_DEFAULT_OPTS='--bind ctrl-n:down,ctrl-e:up'
export KUBECONFIG="$HOME/.kube/k8s-ro.config"
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$HOME/.cargo/bin/:$PATH"
export FNM_LOGLEVEL="quiet"
export PAGER="nvim -R"
export PATH=/home/i337/.fnm:$PATH

autoload -Uz compinit
autoload -Uz edit-command-line
autoload -Uz vcs_info
autoload -U add-zsh-hook
autoload -U select-word-style
autoload -U promptinit; promptinit

for dump in ~/.zcompdump(N.mh+24)
do
  compinit
done

compinit -C
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
# End of lines configured by zsh-newuser-install

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

# use tmux automatically
if [ -z "$TMUX" ]; then
    tmux attach -t w || tmux new -s w
fi

eval "$(pyenv init --path)"

eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"

# general use
alias ls='exa'                                                         # ls
alias l='exa -labF --git'                                              # list, size, type, git
alias ll='exa -lbGF --git'                                             # long list
alias llm='exa -lbGF --git --sort=modified'                            # long list, modified date sort
alias la='exa -lbhHigUmuSa --time-style=long-iso --git --color-scale'  # all list
alias lx='exa -lbhHigUmuSa@ --time-style=long-iso --git --color-scale' # all + extended list
#
# speciality views
alias lS='exa -1' # one column, just names
alias lt='exa --tree --level=2' # tree

alias arst="source ~/.xprofile"

alias ~="cd ~"
alias ..="cd .."
alias ...="cd ../.."
alias ....="cd ../../.."
alias .....="cd ../../../.."

alias src='source ~/.zshrc'
alias t='tmux'
alias v='fnm use --log-level quiet default; nvim'
alias vrc='v ~/.config/nvim/init.vim'
alias vzrc='v ~/.zshrc'
alias k='kubectl'
alias kk='minikube kubectl --'
alias extract='xtract '
alias xx='xrdb ~/.Xresources'
alias redis="iredis"

source ~/.fzf.zsh

source /Users/joseph.rojo/.docker/init-bash.sh || true # Added by Docker Desktop
# [[ -e ~/dotfiles/fpg.sh ]] && source ~/dotfiles/fpg.sh
