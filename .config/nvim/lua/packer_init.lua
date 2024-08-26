-- Automatically install packer
local fn = vim.fn
local o = vim.o
local install_path = fn.stdpath('data') .. '/site/pack/packer/start/packer.nvim'

if fn.empty(fn.glob(install_path)) > 0 then
  packer_bootstrap = fn.system({
    'git',
    'clone',
    '--depth',
    '1',
    'https://github.com/wbthomason/packer.nvim',
    install_path
  })

  o.runtimepath = fn.stdpath('data') .. '/site/pack/*/start/*,' .. o.runtimepath
end

-- Autocommand that reloads neovim whenever you save the packer_init.lua file
vim.cmd [[
  augroup packer_user_config
    autocmd!
    autocmd BufWritePost packer_init.lua source <afile> | PackerSync
  augroup end
]]

-- Use a protected call so we don't error out on first use
local status_ok, packer = pcall(require, 'packer')

if not status_ok then
  return
end

-- Install plugins
return packer.startup(function(use)
  use 'wbthomason/packer.nvim' -- packer can manage itself

  use "rose-pine/neovim"

  use { "williamboman/mason.nvim" }
  use { "williamboman/mason-lspconfig.nvim" }

  use 'neovim/nvim-lspconfig'

  -- File explorer
  use 'kyazdani42/nvim-tree.lua'
  -- Icons
  -- use 'kyazdani42/nvim-web-devicons'

  -- Indent line
  use({ "lukas-reineke/indent-blankline.nvim", module = "ibl" }) 

  -- Indent python
  use 'Vimjas/vim-python-pep8-indent'

  use "ibhagwan/fzf-lua"
  use 'nanotee/zoxide.vim'

  use {
    'nvim-treesitter/nvim-treesitter',
    run = function()
      require('nvim-treesitter.install').update({ with_sync = true })
    end,
  }

  use { 'nvim-treesitter/nvim-treesitter-context', }

  use {
    "theHamsta/nvim-treesitter-pairs",
  }

  -- use {
  --   "RRethy/nvim-treesitter-textsubjects",
  -- }

  -- Autocomplete
  use {
    'hrsh7th/nvim-cmp',
    requires = {
      'L3MON4D3/LuaSnip',
      'hrsh7th/cmp-buffer',
      'hrsh7th/cmp-cmdline',
      'hrsh7th/cmp-nvim-lsp',
      'hrsh7th/cmp-path',
      'hrsh7th/nvim-cmp',
      'hrsh7th/cmp-nvim-lua',
      'saadparwaiz1/cmp_luasnip',
    },
  }

  use 'jiangmiao/auto-pairs'
  use 'terrortylor/nvim-comment'
  use 'lewis6991/gitsigns.nvim'

  -- utilities
  use 't9md/vim-smalls'
  use 'tpope/vim-fugitive'
  use 'tpope/vim-obsession'
  use 'tpope/vim-repeat'
  use 'tpope/vim-surround'
  use 'unblevable/quick-scope'
  use 'wellle/targets.vim'
  use 'christoomey/vim-tmux-navigator'
  use 'dhruvasagar/vim-table-mode'
  use 'jose-elias-alvarez/typescript.nvim'
  use 'MunifTanjim/eslint.nvim'
  use {
    'andythigpen/nvim-coverage',
    requires = {
      "nvim-lua/plenary.nvim"
    }
  }
  -- use "nvim-lua/plenary.nvim"

  use {'andymass/vim-matchup', event = 'VimEnter'}
  use {
    "windwp/nvim-autopairs",
    event = "InsertEnter",
    config = function()
      require("nvim-autopairs").setup {}
    end
  }

  use {
    "windwp/nvim-ts-autotag",
    config = function()
      require("nvim-ts-autotag").setup {}
    end
  }

  use "rafamadriz/friendly-snippets"

  use {
    "glacambre/firenvim",
    run = function()
      vim.fn["firenvim#install"](0)
    end,
  }

  use {
      "vinnymeller/swagger-preview.nvim",
      run = "npm install -g swagger-ui-watcher",
  }

  use({
    "iamcco/markdown-preview.nvim",
    run = function() vim.fn["mkdp#util#install"]() end,
  })

  use({
    'MeanderingProgrammer/markdown.nvim',
    as = 'render-markdown', -- Only needed if you have another plugin named markdown.nvim
    after = { 'nvim-treesitter' },
    requires = { 'echasnovski/mini.nvim', opt = true }, -- if you use the mini.nvim suite
    -- requires = { 'echasnovski/mini.icons', opt = true }, -- if you use standalone mini plugins
    -- requires = { 'nvim-tree/nvim-web-devicons', opt = true }, -- if you prefer nvim-web-devicons
    config = function()
      require('render-markdown').setup({})
    end,
  })

  use 'mfussenegger/nvim-dap'
  use 'mfussenegger/nvim-dap-python'
  use 'tzachar/local-highlight.nvim'
  use 'levouh/tint.nvim'
  use 'JoosepAlviste/nvim-ts-context-commentstring'

  use {
    'kevinhwang91/nvim-hlslens',
    config = function ()
      require('hlslens').setup {}
    end
  }

  use {'kevinhwang91/nvim-bqf'}

  use({
    "stevearc/quicker.nvim",
    config = function()
      require("quicker").setup()
    end,
  })

  use "jbyuki/venn.nvim"

  use {"shortcuts/no-neck-pain.nvim", tag = "*" }

  use "mfussenegger/nvim-lint"
  use {
    "nvimtools/none-ls.nvim",
      requires = {
        "nvimtools/none-ls-extras.nvim",
      },

  }

  -- use({
  --   "epwalsh/obsidian.nvim",
  --   tag = "*",  -- recommended, use latest release instead of latest commit
  --   requires = {
  --     -- Required.
  --     "nvim-lua/plenary.nvim",
  --
  --     -- see below for full list of optional dependencies 👇
  --   },
  -- })

  -- Automatically set up your configuration after cloning packer.nvim
  -- Put this at the end after all plugins
  if packer_bootstrap then
    require('packer').sync()
  end
end)
