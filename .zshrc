# Created by newuser for 5.7.1
# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

# Path to your oh-my-zsh installation.
export ZSH=$HOME/.oh-my-zsh

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time oh-my-zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/robbyrussell/oh-my-zsh/wiki/Themes

ZSH_THEME="agnoster"
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
# DISABLE_AUTO_TITLE="true"

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
        git
        docker
        extract
        npm
        pip
        redis-cli
        tmux
        zsh-autosuggestions
        zsh-completions
        zsh-syntax-highlighting
        jsontools
        )

autoload -U compinit && compinit # for zsh-completions

source $ZSH/oh-my-zsh.sh

# User configuration
# 10ms for key sequences
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=5'
KEYTIMEOUT=1
bindkey -v 

bindkey '^R' history-incremental-search-backward # vi style incremental search
bindkey '^S' history-incremental-search-forward
bindkey '^P' history-search-backward
bindkey '^N' history-search-forward  

bindkey '^ ' autosuggest-accept
# export MANPATH="/usr/local/man:$MANPATH"

# You may need to manually set your language environment
# export LANG=en_US.UTF-8
# Updates editor information when the keymap changes.
vim_ins_mode="%{$fg[cyan]%}[INS]%{$reset_color%}"
vim_cmd_mode="%{$fg[green]%}[CMD]%{$reset_color%}"
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
RPROMPT='${vim_mode}'
# Fix a bug when you C-c in CMD mode and you'd be prompted with CMD mode indicator, while in fact you would be in INS mode
# Fixed by catching SIGINT (C-c), set vim_mode to INS and then repropagate the SIGINT, so if anything else depends on it, we will not break it
# Thanks Ron! (see comments)
function TRAPINT() {
  vim_mode=$vim_ins_mode
  return $(( 128 + $1 ))
}
# Preferred editor for local and remote sessions
if [[ -n $SSH_CONNECTION ]]; then
  export EDITOR='vim'
else
  export EDITOR='nvim'
fi

# use tmux automatically
if [ -z "$TMUX" ]; then
    tmux attach -t 133t || tmux new -s 133t
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
alias v="nvim"
alias c=reset
alias "\q"=exit
alias t=tmux
# alias FirstPerformance=~/FirstPerformance
# alias washington=~/FirstPerformance/washington
# alias data-models=~/FirstPerformance/data-models
# alias tweedle-dum=~/FirstPerformance/tweedle-dum
# alias lincoln-project=~/FirstPerformance/lincoln-project
# alias lincoln=~/FirstPerformance/lincoln-project/lincoln
# alias fp-central-core=~/FirstPerformance/lincoln-project/fp-central-core
# alias fp-core=~/FirstPerformance/lincoln-project/fp-core
# alias fp-plugins=~/FirstPerformance/lincoln-project/fp-plugins
# alias knex-base=~/FirstPerformance/lincoln-project/knex-base
# alias fp-central-jobs=~/FirstPerformance/lincoln-project/fp-central-jobs

export WORK_PROJECTS=~/FirstPerformance

cd $WORK_PROJECTS
for dir in */; do
  local lincoln="lincoln-project"
  local project=${dir%?}
  alias $project=$WORK_PROJECTS/$dir

  if [ "$project" = "$lincoln" ]; then
    cd $project
    for lincoln_projects in */; do
      local lincoln_project=${lincoln_projects%?}
      alias $lincoln_project="$(pwd)/$lincoln_project"
    done
    cd ..
  fi
done
cd

alias FirstPerformance="$WORK_PROJECTS"
alias db="mycli -h 172.17.0.2 -P 3306 -u root -proot"
alias vrc="nvim ~/.local/share/nvim/site/init.vim"
alias vzrc="nvim ~/.zshrc"
alias notes=~/Notes
alias standup=~/standup
alias lincoln-dev-central="cd ~/FirstPerformance/lincoln-project/lincoln && npm run dev-central"


###-tns-completion-start-###
# if [ -f /home/rojo/.tnsrc ]; then 
#     source /home/rojo/.tnsrc 
# fi
###-tns-completion-end-###
export JAVA_HOME=/usr/lib/jvm/default
export PATH=$PATH:$JAVA_HOME/bin
export ANDROID_HOME=~/Android/Sdk
export PATH=$PATH:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools
