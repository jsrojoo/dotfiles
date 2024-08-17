require('options')

require('plugins/mason-lsp-installer')
require('plugins/lsp-config')
require('plugins/completions')
require('plugins/python')

require "paq" {
    "savq/paq-nvim",
    "neovim/nvim-lspconfig",

    "shaunsingh/nord.nvim",

    "spywhere/tmux.nvim",
}

vim.cmd([[
colorscheme nord
]])



