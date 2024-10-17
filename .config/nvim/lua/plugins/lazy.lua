local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  local lazyrepo = "https://github.com/folke/lazy.nvim.git"
  local out = vim.fn.system({ "git", "clone", "--filter=blob:none", "--branch=stable", lazyrepo, lazypath })
  if vim.v.shell_error ~= 0 then
    vim.api.nvim_echo({
      { "Failed to clone lazy.nvim:\n", "ErrorMsg" },
      { out,                            "WarningMsg" },
      { "\nPress any key to exit..." },
    }, true, {})
    vim.fn.getchar()
    os.exit(1)
  end
end
vim.opt.rtp:prepend(lazypath)

local status_ok, lazy = pcall(require, "lazy")

if not status_ok then
  return
end

lazy.setup({
  "rose-pine/neovim",

  {
    "catppuccin/nvim",
    name = "catppuccin"
  },
  {
    "norcalli/nvim-colorizer.lua",
    opts = {},
  },

  { "williamboman/mason.nvim" },
  { "williamboman/mason-lspconfig.nvim" },

  "neovim/nvim-lspconfig",

  -- Indent line
  {
    "lukas-reineke/indent-blankline.nvim",
    main = "ibl",
    opts = {}
  },

  -- Indent python
  "Vimjas/vim-python-pep8-indent",

  "ibhagwan/fzf-lua",
  "nanotee/zoxide.vim",

  {
    "nvim-treesitter/nvim-treesitter",
    build = function()
      require("nvim-treesitter.install").update({ with_sync = true })
    end,
  },

  -- { "nvim-treesitter/nvim-treesitter-context" },

  {
    "theHamsta/nvim-treesitter-pairs",
  },

  {
    "RRethy/nvim-treesitter-textsubjects",
  },

  -- Autocomplete
  {
    "hrsh7th/nvim-cmp",
    dependencies = {
      "L3MON4D3/LuaSnip",
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-cmdline",
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-path",
      "hrsh7th/nvim-cmp",
      "hrsh7th/cmp-nvim-lua",
      "saadparwaiz1/cmp_luasnip",
    },
  },

  "jiangmiao/auto-pairs",
  "terrortylor/nvim-comment",
  "lewis6991/gitsigns.nvim",

  -- utilities
  "t9md/vim-smalls",
  "tpope/vim-fugitive",
  "tpope/vim-repeat",
  "tpope/vim-surround",
  "wellle/targets.vim",
  "christoomey/vim-tmux-navigator",
  "dhruvasagar/vim-table-mode",
  "jose-elias-alvarez/typescript.nvim",
  -- "MunifTanjim/eslint.nvim",
  {
    "andythigpen/nvim-coverage",
  },

  {
    "windwp/nvim-autopairs",
    event = "InsertEnter",
    opts = {},
  },

  {
    "windwp/nvim-ts-autotag",
    opts = {},
  },

  "rafamadriz/friendly-snippets",

  {
    "glacambre/firenvim",
    build = function()
      vim.fn["firenvim#install"](0)
    end,
  },

  {
    "vinnymeller/swagger-preview.nvim",
    build = "npm install -g swagger-ui-watcher",
  },

  {
    "iamcco/markdown-preview.nvim",
    cmd = { "MarkdownPreviewToggle", "MarkdownPreview", "MarkdownPreviewStop" },
    build = "cd app && yarn install",
    init = function()
      vim.g.mkdp_filetypes = { "markdown" }
    end,
    ft = { "markdown" },
  },

  -- use({
  -- 	"MeanderingProgrammer/markdown.nvim",
  -- 	name = "render-markdown", -- Only needed if you have another plugin named markdown.nvim
  -- 	after = { "nvim-treesitter" },
  -- 	-- dependencies = { "echasnovski/mini.nvim", opt = true }, -- if you use the mini.nvim suite
  -- 	-- dependencies = { 'echasnovski/mini.icons', opt = true }, -- if you use standalone mini plugins
  -- 	dependencies = { "nvim-tree/nvim-web-devicons", opt = true }, -- if you prefer nvim-web-devicons
  -- 	config = function()
  -- 		require("render-markdown").setup({})
  -- 	end,
  -- })

  "epwalsh/obsidian.nvim",

  "mfussenegger/nvim-dap",
  "mfussenegger/nvim-dap-python",
  "tzachar/local-highlight.nvim",
  "levouh/tint.nvim",
  "JoosepAlviste/nvim-ts-context-commentstring",

  { "kevinhwang91/nvim-bqf" },

  {
    "stevearc/quicker.nvim",
    opts = {},
  },

  "jbyuki/venn.nvim",

  {
    "ThePrimeagen/refactoring.nvim",
    dependencies = {
      { "nvim-lua/plenary.nvim" },
      { "nvim-treesitter/nvim-treesitter" },
    },
  },

  "napmn/react-extract.nvim",
  {
    "pmizio/typescript-tools.nvim",
    dependencies = { "nvim-lua/plenary.nvim", "neovim/nvim-lspconfig" },
    opts = {
      on_attach = function(client, bufnr)
        vim.keymap.set({ "n", "v" }, "<leader>ca", vim.lsp.buf.code_action, { buffer = bufnr })
      end,
      settings = {
        separate_diagnostic_server = true,
      },
    },
  },

  "tpope/vim-dadbod",
  "kristijanhusak/vim-dadbod-ui",
  "kristijanhusak/vim-dadbod-completion",
  "shumphrey/fugitive-gitlab.vim",
  "stevearc/oil.nvim",

  "folke/zen-mode.nvim",
  "folke/twilight.nvim",
  "kkharji/sqlite.lua",
  "utilyre/sentiment.nvim",

  {
    "quarto-dev/quarto-nvim",
    dependencies = {
      "jmbuhr/otter.nvim",
      "nvim-treesitter/nvim-treesitter",
    },
    opts = {
      debug = false,
      closePreviewOnExit = true,
      lspFeatures = {
        enabled = true,
        chunks = "curly",
        languages = { "r", "python", "julia", "bash", "html" },
        diagnostics = {
          enabled = true,
          triggers = { "BufWritePost" },
        },
        completion = {
          enabled = true,
        },
      },
      codeRunner = {
        enabled = false,
        default_method = nil,   -- 'molten' or 'slime'
        ft_runners = {},        -- filetype to runner, ie. `{ python = "molten" }`.
        -- Takes precedence over `default_method`
        never_run = { "yaml" }, -- filetypes which are never sent to a code runner
      },
    }
  },

  {
    "ariel-frischer/bmessages.nvim",
    opts = {},
  },

  {
    "nvimtools/none-ls.nvim"
  },

  {
    "NStefan002/speedtyper.nvim",
    cmd = "Speedtyper",
    opts = {
      -- your config
    }
  },

  checker = { enabled = true },
})
