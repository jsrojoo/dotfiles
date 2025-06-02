import os

urls = [
    "https://gitlab.scm-emea.aws.fisv.cloud/EMEA/GBS/EGPT/applications/apis/aitrium-document-conversion-api/-/pipelines",
]


os.system('tmux display-popup -E "echo \"test\" | fzf"')
