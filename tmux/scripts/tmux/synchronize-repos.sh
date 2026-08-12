tmux splitw -c ~/fiserv/aitrium/enterprise-gpt-ui/
tmux splitw -c ~/fiserv/aitrium/aitrium-document-search-api/
tmux splitw -c ~/fiserv/aitrium/aitrium-document-conversion-api/

tmux setw synchronize-panes
tmux select-layout even-vertical
