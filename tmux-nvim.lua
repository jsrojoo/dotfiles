-- if you're cloning the repository, you will need to add the plugin directory
--   to the 'runtimepath'
vim.opt.rtp:append('~/.tmux.nvim')

local tmux = require('tmux')
local cmds = require('tmux.commands')

-- some configurations go here

-- may be changing the default prefix key?
tmux.prefix('<C-a>')

-- may be binding a new key?
tmux.bind('v', cmds.split_window { 'v' } )
tmux.bind('s', cmds.split_window { 'h' } )

tmux.start() -- this will start a terminal session

