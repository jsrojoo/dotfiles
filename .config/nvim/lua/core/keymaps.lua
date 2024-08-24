-----------------------------------------------------------
-- Define keymaps of Neovim and installed plugins.
-----------------------------------------------------------
local function map(mode, lhs, rhs, opts)
  local options = { noremap=true, silent=true }
  if opts then
    options = vim.tbl_extend('force', options, opts)
  end
  vim.api.nvim_set_keymap(mode, lhs, rhs, options)
end

local function modemap(mode, lhs, rhs, opts)
  return map(mode, lhs, rhs, opts)
end

local function nmap(lhs, rhs, opts)
  return modemap('n', lhs, rhs, opts)
end

local function tmap(lhs, rhs, opts)
  return modemap('t', lhs, rhs, opts)
end

local function tmapleader(lsh, rhs, opts)
  return tmap('<space>' .. lsh, rhs, opts)
end

local function nmapleader(lsh, rhs, opts)
  return nmap('<leader>' .. lsh, rhs, opts)
end
-----------------------------------------------------------
-- Neovim shortcuts
-----------------------------------------------------------

-- Disable arrow keys
map('', '<up>', '<nop>')
map('', '<down>', '<nop>')
map('', '<left>', '<nop>')
map('', '<right>', '<nop>')

-- Map space to leader key
map('', '<space>', '<leader>', { noremap=false })

-- Convenience keymaps
nmapleader('w', ':w!<cr>')
nmapleader('q', ':q!<cr>')
nmapleader(';', ':')

nmapleader('fs', ':set foldmethod=expr<CR>')
nmapleader('fi', ':set foldmethod=indent<CR>')

tmapleader('<esc>', '<C-\\><C-n>')

nmap('<C-h>', '<C-w>h')
nmap('<C-j>', '<C-w>j')
nmap('<C-k>', '<C-w>k')
nmap('<C-l>', '<C-w>l')
nmap('<leader>h', '<C-w>h')
nmap('<leader>j', '<C-w>j')
nmap('<leader>k', '<C-w>k')
nmap('<leader>l', '<C-w>l')

-- nmap('z', ':Z ')

nmap('<C-w>v', '<C-w>v<C-w><C-w>')
nmap('<C-w>s', '<C-w>s<C-w><C-w>')

-- Remap increment
nmap('<C-s>', '<C-a>')

-----------------------------------------------------------
-- Plugin shortcuts
-----------------------------------------------------------
-- FZF

nmapleader('ag', ':FzfLua grep_project<cr>')
nmapleader('fg', ':FzfLua files<cr>')
nmapleader('<space>', ':FzfLua buffers<cr>')
nmapleader('fa', ':FzfLua git_files<cr>')
nmapleader('ss', ':FzfLua blines<cr>')
nmapleader('cw', ':FzfLua grep_cword<cr>')
nmapleader('fc', ':FzfLua commands<cr>')
nmapleader('fh', ':FzfLua helptags<cr>')

-- Smalls
map('n', 's', '<Plug>(smalls)', { noremap=false })
map('o', 's', '<Plug>(smalls)', { noremap=false })
map('x', 's', '<Plug>(smalls)', { noremap=false })

local opts = { noremap=true, silent=true }

vim.keymap.set('n', '<space>e', vim.diagnostic.open_float, opts)
vim.keymap.set('n', ']d', vim.diagnostic.goto_prev, opts)
vim.keymap.set('n', '[d', vim.diagnostic.goto_next, opts)
vim.keymap.set('n', '<leader>dl', vim.diagnostic.setloclist, opts)
