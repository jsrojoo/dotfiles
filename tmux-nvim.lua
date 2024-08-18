local tmux = require('tmux')
local cmds = require('tmux.commands')

-- some configurations go here

-- may be changing the default prefix key?
tmux.prefix('<C-a>')

-- may be binding a new key?
tmux.bind('v', cmds.split_window { 'v' } )
tmux.bind('s', cmds.split_window { 'h' } )

tmux.bind('h', cmds.select_pane { 'L' } )
tmux.bind('j', cmds.select_pane { 'D' } )
tmux.bind('k', cmds.select_pane { 'U' } )
tmux.bind('l', cmds.select_pane { 'R' } )

tmux.start() -- this will start a terminal session

vim.cmd.colorscheme 'github_light_default'

