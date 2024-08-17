utils = require('utils')

local map = utils.map

-- Change leader to a space
vim.g.mapleader = ' '

map('n', '<space>', '<nop>')
map('n', '<leader>w', ':w<cr>')
map('n', '<leader>q', ':q!<cr>')
map('n', '<leader>r', ':so %<CR>')
map('n', '<leader>r', ':so %<CR>:PaqInstall<cr>')

map('n', '<leader>fi', ':set foldmethod=indent')
map('n', '<leader>fs', ':set foldmethod=syntax')
