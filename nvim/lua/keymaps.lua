local function map(mode, lhs, rhs, opts)
  local options = { noremap=true, silent=true }

  if opts then
    options = vim.tbl_extend('force', options, opts)
  end

  vim.api.nvim_set_keymap(mode, lhs, rhs, options)
end

-- Change leader to a space
vim.g.mapleader = ' '

map('n', '<space>', '<nop>')
map('n', '<leader>w', ':w<cr>')
map('n', '<leader>q', ':qa!<cr>')
map('n', '<leader>r', ':so %<CR>')
