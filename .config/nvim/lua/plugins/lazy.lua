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
  "https://github.com/hardselius/warlock",

  {
    "NStefan002/screenkey.nvim",
    lazy = false,
    version = "*", -- or branch = "dev", to use the latest commit
  },

  {
    "norcalli/nvim-colorizer.lua",
    opts = {},
  },

  { "williamboman/mason.nvim" },

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

  -- Show the current Treesitter context (e.g., function/class) at the top
  {
    "nvim-treesitter/nvim-treesitter-context",
    main = "treesitter-context",
    opts = {
      enable = true,
      max_lines = 3,            -- limit context lines shown
      trim_scope = "outer",     -- which scope to discard if too long
      mode = "cursor",          -- update context based on cursor position
      multiline_threshold = 20, -- max lines for a single context chunk
      min_window_height = 0,    -- 0 disables the check
      zindex = 20,
      on_attach = nil,          -- nil => enable for all filetypes
    },
    keys = {
      { "[c",         function() require("treesitter-context").go_to_context() end, desc = "Go to Treesitter context" },
      { "<leader>tc", "<cmd>TSContextToggle<CR>",                                   desc = "Toggle Treesitter Context" },
    },
  },

  -- Autocomplete
  {
    "hrsh7th/nvim-cmp",
    dependencies = {
      "https://github.com/SergioRibera/cmp-dotenv",
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

  "terrortylor/nvim-comment",
  "lewis6991/gitsigns.nvim",

  -- utilities
  "t9md/vim-smalls",
  "tpope/vim-fugitive",
  "tpope/vim-repeat",
  "tpope/vim-surround",
  "wellle/targets.vim",
  "dhruvasagar/vim-table-mode",
  "jose-elias-alvarez/typescript.nvim",

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
    build = "npm i",
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

  "obsidian-nvim/obsidian.nvim",

  "mfussenegger/nvim-dap",
  "mfussenegger/nvim-dap-python",
  "levouh/tint.nvim",

  { "kevinhwang91/nvim-bqf" },

  {
    "stevearc/quicker.nvim",
    opts = {},
  },

  "jbyuki/venn.nvim",

  "napmn/react-extract.nvim",

  "tpope/vim-dadbod",
  "kristijanhusak/vim-dadbod-ui",
  "kristijanhusak/vim-dadbod-completion",
  "shumphrey/fugitive-gitlab.vim",
  "stevearc/oil.nvim",

  "kkharji/sqlite.lua",

  {
    "ariel-frischer/bmessages.nvim",
    opts = {},
  },

  {
    "nvimtools/none-ls.nvim"
  },

  {
    "carlos-algms/agentic.nvim",

    event = "VeryLazy",

    opts = {
      provider = "codex-acp",
      acp_providers = {
        ["codex-acp"] = {
          env = {
            NODE_NO_WARNINGS = "1",
            IS_AI_TERMINAL = "1",
            AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY"),
            AZURE_DEV_OPENAI_API_KEY = os.getenv("AZURE_DEV_OPENAI_API_KEY"),
          },
          default_mode = "bypassPermissions",
        },
      },
      windows = { width = "100%" },
      -- Add <leader>w as a submit key in Agentic's Prompt buffer
      -- Keep <CR> and <C-s> so existing behavior remains
      keymaps = {
        prompt = {
          submit = {
            "<CR>",
            -- { "<C-s>",     mode = { "i", "n", "v" } },
            { "<leader>w", mode = { "n" } },
          },
          -- Use a string to fully override defaults (normal-mode only for paste)
          paste_image = "<localleader>p",
        },
      },
    },
  },
  install = { colorscheme = { "warlock" } },
  checker = { enabled = true },
})
