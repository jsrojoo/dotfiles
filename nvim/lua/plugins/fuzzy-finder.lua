require "paq" {
  'ibhagwan/fzf-lua',
}

local utils = require('utils')

local nmapleader = utils.nmapleader

nmapleader('ag', ':FzfLua grep_project<cr>')
nmapleader('fg', ':FzfLua files<cr>')
nmapleader('<space>', ':FzfLua buffers<cr>')
nmapleader('fa', ':FzfLua git_files<cr>')
nmapleader('ss', ':FzfLua blines<cr>')
nmapleader('cw', ':FzfLua grep_cword<cr>')
nmapleader('fc', ':FzfLua commands<cr>')
nmapleader('fh', ':FzfLua helptags<cr>')
nmapleader('fk', ':FzfLua keymaps<cr>')
