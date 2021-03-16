# Created by newuser for 5.7.1
# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

# Path to your oh-my-zsh installation.
export ZSH=$HOME/.oh-my-zsh

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time oh-my-zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/robbyrussell/oh-my-zsh/wiki/Themes

ZSH_THEME="avit"
# Set list of themes to pick from when loading at random
# Setting this variable when ZSH_THEME=random will cause zsh to load
# a theme from this variable instead of looking in ~/.oh-my-zsh/themes/
# If set to an empty array, this variable will have no effect.
# ZSH_THEME_RANDOM_CANDIDATES=( "robbyrussell" "agnoster" )

# Uncomment the following line to use case-sensitive completion.
# CASE_SENSITIVE="true"

# Uncomment the following line to use hyphen-insensitive completion.
# Case-sensitive completion must be off. _ and - will be interchangeable.
# HYPHEN_INSENSITIVE="true"

# Uncomment the following line to disable bi-weekly auto-update checks.
# DISABLE_AUTO_UPDATE="true"

# Uncomment the following line to automatically update without prompting.
# DISABLE_UPDATE_PROMPT="true"

# Uncomment the following line to change how often to auto-update (in days).
# export UPDATE_ZSH_DAYS=13

# Uncomment the following line if pasting URLs and other text is messed up.
# DISABLE_MAGIC_FUNCTIONS=true

# Uncomment the following line to disable colors in ls.
# DISABLE_LS_COLORS="true"

# Uncomment the following line to disable auto-setting terminal title.
DISABLE_AUTO_TITLE="true"

# Uncomment the following line to enable command auto-correction.
# ENABLE_CORRECTION="true"

# Uncomment the following line to display red dots whilst waiting for completion.
# COMPLETION_WAITING_DOTS="true"

# Uncomment the following line if you want to disable marking untracked files
# under VCS as dirty. This makes repository status check for large repositories
# much, much faster.
# DISABLE_UNTRACKED_FILES_DIRTY="true"

# Uncomment the following line if you want to change the command execution time
# stamp shown in the history command output.
# You can set one of the optional three formats:
# "mm/dd/yyyy"|"dd.mm.yyyy"|"yyyy-mm-dd"
# or set a custom format using the strftime function format specifications,
# see 'man strftime' for details.
# HIST_STAMPS="mm/dd/yyyy"

# Would you like to use another custom folder than $ZSH/custom?
# ZSH_CUSTOM=/path/to/new-custom-folder

# Which plugins would you like to load?
# Standard plugins can be found in ~/.oh-my-zsh/plugins/*
# Custom plugins may be added to ~/.oh-my-zsh/custom/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(
        auto-notify
        docker
        extract
        # git
        jsontools
        npm
        pip
        redis-cli
        tmux
        z
        zsh-autosuggestions
        zsh-completions
        zsh-syntax-highlighting
        zsh_reload
        vi-mode
        )

autoload -U compinit && compinit # for zsh-completions

source $ZSH/oh-my-zsh.sh

# User configuration
# 10ms for key sequences
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=5'

bindkey '^ ' autosuggest-accept
KEYTIMEOUT=1
# export MANPATH="/usr/local/man:$MANPATH"
#
# You may need to manually set your language environment
# export LANG=en_US.UTF-8
# Updates editor information when the keymap changes.
vim_ins_mode="%{$fg[cyan]%}I%{$reset_color%}"
vim_cmd_mode="%{$fg[green]%}C%{$reset_color%}"
vim_mode=$vim_ins_mode

function zle-keymap-select {
  vim_mode="${${KEYMAP/vicmd/${vim_cmd_mode}}/(main|viins)/${vim_ins_mode}}"
  zle reset-prompt
}
zle -N zle-keymap-select

function zle-line-finish {
  vim_mode=$vim_ins_mode
}
zle -N zle-line-finish

PROMPT=$PROMPT'[${vim_mode} λ] '
# Fix a bug when you C-c in CMD mode and you'd be prompted with CMD mode indicator, while in fact you would be in INS mode
# Fixed by catching SIGINT (C-c), set vim_mode to INS and then repropagate the SIGINT, so if anything else depends on it, we will not break it
# Thanks Ron! (see comments)
# function TRAPINT() {
#   vim_mode=$vim_ins_mode
#   return $(( 128 + $1 ))
# }
# Preferred editor for local and remote sessions
if [[ -n $SSH_CONNECTION ]]; then
  export EDITOR='vim'
else
  export EDITOR='nvim'
fi

# use tmux automatically
if [ -z "$TMUX" ]; then
    tmux attach -t w || tmux new -s w
fi

# This loads NVM
[[ -s $HOME/.nvm/nvm.sh ]] && . $HOME/.nvm/nvm.sh
# Compilation flags
# export ARCHFLAGS="-arch x86_64"

# Set personal aliases, overriding those provided by oh-my-zsh libs,
# plugins, and themes. Aliases can be placed here, though oh-my-zsh
# users are encouraged to define aliases within the ZSH_CUSTOM folder.
# For a full list of active aliases, run `alias`.
#
# Example aliases
# alias zshconfig="mate ~/.zshrc"
# alias ohmyzsh="mate ~/.oh-my-zsh"
# WORK_PROJECTS="/home/rojo/fp"

alias "\q"="exit"
alias "arst"="setxkbmap us && fixKeeb"
alias "asdf"="setxkbmap us -variant colemak && fixKeeb"
alias "c"="reset"
alias "cat"="bat"
alias "db"="cd ~/fp/sql && mycli -h 172.17.0.2 -P 3306 -u root -proot"
alias "dots"="~/dotfiles"
alias "paci"="sudo pacman -S $1"
alias "q"="npm run test"
alias "redis"="iredis"
alias "redis-cluster"="cd ~/fp/redis-5.0.7/utils/create-cluster && ./create-cluster start"
alias "run"="cd ~/fp/eg-repos/components/fp-eg/fpeg && ./run.sh"
alias "send-test-buffer"="cd ~/fp/eg-repos/components/fp-eg/fpeg && ./send-test-buffer.sh"
alias "slack"="trickle -u 50 -d 50 slack &"
alias "t"="tmux"
alias "timedoctor"="trickle -u 50 -d 50 timedoctor &"
alias "update"="sudo pacman -Syyu"
alias "use-colemak"="setxkbmap us -variant colemak"
alias "v"="nvim"
alias "vmux"="v ~/.local/share/nvim/site/config/vimux.vim"
alias "vrc"="nvim ~/.local/share/nvim/site/init.vim"
alias "vzrc"="nvim ~/.zshrc"
alias "yai"="yay -S $1"
alias "yau"="yay -R $1"
alias "k"="kubectl"

alias "ssh-oracle"="ssh fp-vanilla-oracle-docker-qa"

function useContext () {
  # arn:aws:eks:us-east-1:739760443361:cluster/k8s-dev
  # fp-k8s.firstperformance.com-ro
  # k8s.dev.firstperformance.com-ro

  context="arn:aws:eks:us-east-1:739760443361:cluster/k8s-dev"

  case $1 in
    clients)
      context="arn:aws:eks:us-east-1:739760443361:cluster/k8s-dev"
      ;;
    gitops|dev)
      context="fp-k8s.firstperformance.com-ro"
      ;;
    *)
      context="arn:aws:eks:us-east-1:739760443361:cluster/k8s-dev"
      ;;
  esac

  k config use-context $context
}

function getPods () {
  k -n $1 get pods
}

gitCommitToCurrentBranch () {
  local message=$1
  git commit -m "id:$(git rev-parse --abbrev-ref HEAD) $message"
}

gitPushToCurrentBranch () {
  git push origin $(git rev-parse --abbrev-ref HEAD) $1
}

gitPullRebase () {
  git pull upstream --rebase $1
}

fixKeeb () {
  setxkbmap -option ctrl:nocaps;
  xcape -e 'Control_L=Escape';
  xmodmap -e "keycode 108 = Alt_R Meta_R Alt_R Meta_R"
  # xset r rate 280 120;
}

function gateway () {
  gatewaytype=$1

  docker run --name api-gateway-$gatewaytype --network="host" \
    --volume /mnt/sda/fp/winter-v5/fp-api-gateway/config/$gatewaytype-gateway.config.yml:/var/lib/eg/gateway.config.yml \
    --rm api-gateway
}

wa () {
  config=$1

  TZ=utc nodemon -r dotenv/config \
    --max_old_space_size=5120 \
    --harmony index.js \
    dotenv_config_path=$PWD/$config.env
}

de () {
  config=$1

  echo $config
  TZ=utc nodemon -r dotenv/config \
    --max_old_space_size=5120 \
    --harmony ./bin/index.js \
    dotenv_config_path=$PWD/$config.env
}

apil () {
  de $1;
}

noidle () {
  python /mnt/sda/Software/pygui/test.py
}

eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"

[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

###-tns-completion-start-###
if [ -f /home/rojo/.tnsrc ]; then
    source /home/rojo/.tnsrc
fi
###-tns-completion-end-###
#

source <(kubectl completion zsh)

export ANDROID_HOME=~/Android/Sdk
export AUTO_NOTIFY_THRESHOLD=5 # auto-notify plugin
export JAVA_HOME=/usr/lib/jvm/default
export PATH=$PATH:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools/bin:$ANDROID_HOME/tools/bin:/home/rojo/.gem/ruby/2.7.0/bin
export FZF_DEFAULT_OPTS='--bind ctrl-n:down,ctrl-e:up'
export KUBECONFIG="$HOME/.kube/k8s-ro.config"
export DOCKER_GATEWAY_HOST=172.17.0.1
