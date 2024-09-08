-- Create a function to allow to quickly switch to a tmux session from within vim
-- It should be integrated with zoxide.
-- I should be able to switch using (<leader>z) mapping.
-- It should list out all window panes and sessions available.
-- If no session if found, create a new session

-- get a list of supported zoxide paths
-- then only get basename
-- hypens are not supported, so make sure that hypens are only converted to
-- underscores.
_G.zmux = function(opts)
  local fzf_lua = require("fzf-lua")

  opts = opts or {}

  opts.fn_transform = function(x)
    return fzf_lua.utils.ansi_codes.magenta(x)
  end

  opts.actions = {
    ["default"] = function(selected)
      local path = selected[1]
      local session_name = string.gsub(path, "(.*/)(.*)", "%2")

      local cd_cmd = string.format("-c %s", path)
      local create_new_session_cmd = string.format("tmux new -d -s %s %s", session_name, cd_cmd)
      local switch_session_cmd = string.format("tmux switch -t %s", session_name)

      vim.fn.system(create_new_session_cmd .. " 'nvim -S '")
      vim.fn.system(switch_session_cmd)
    end,
  }
  -- fzf_lua.fzf_exec("zoxide query -l | xargs basename | tr '-' '_'", opts)
  fzf_lua.fzf_exec("zoxide query -l", opts)
end

vim.cmd([[command! -nargs=* Zmux lua _G.zmux()]])
