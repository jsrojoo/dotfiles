require("nvim-treesitter.configs").setup({
	textsubjects = {
		enable = false,
		prev_selection = ",", -- (Optional) keymap to select the previous selection
		keymaps = {
			["."] = "textsubjects-smart",
			["af"] = "textsubjects-container-outer",
			["if"] = { "textsubjects-container-inner", desc = "Select inside containers (classes, functions, etc.)" },
		},
	},
})
