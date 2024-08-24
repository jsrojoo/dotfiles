require('core/options')
require('core/keymaps')

require('packer_init')

vim.cmd.colorscheme('rose-pine')

require('plugins/nvim-cmp')
require('lsp/lspconfig')
require('plugins/fzf-lua')
require('plugins/indent-blankline')
require('plugins/smalls')
require('plugins/quick-scope')
require('plugins/gitsigns')
require('plugins/luasnip')
require('plugins/firenvim')
require('plugins/eslint')
require('plugins/nvim-treesitter')

-- require('plugins/obsidian')

-- plugins
require('nvim_comment').setup()
require('swagger-preview').setup({})

require('local-highlight').setup({
    file_types = {'python', 'cpp', 'lua'},
    disable_file_types = {'tex'},
    hlgroup = 'Search',
    cw_hlgroup = nil,
    insert_mode = false,
    min_match_len = 1,
    max_match_len = math.huge,
    highlight_single_match = true,
})

local plugins = {
  'tint',
  'coverage',
  'no-neck-pain',
  'hlslens',
}

for _, plugin in ipairs(plugins) do
  local status_ok, plug = pcall(require, plugin)

  plug.setup({})

  if plugin == 'no-neck-pain' then
    plug.enable()
  end
end

