#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Fortify Scans
# @raycast.mode compact

# Optional parameters:
# @raycast.icon 
# @raycast.packageName API

# Documentation:
# @raycast.description Fortify Scans
# @raycast.author Joseph Rojo

admin="https://fortify.fiserv.one/ssc/html/ssc/version/10459128862"
api="https://fortify.fiserv.one/ssc/html/ssc/version/9403898674"
aspt="https://fortify.fiserv.one/ssc/html/ssc/version/9836243782"
conversion="https://fortify.fiserv.one/ssc/html/ssc/version/10459122097"
extraction="https://fortify.fiserv.one/ssc/html/ssc/version/14212321256"
search="https://fortify.fiserv.one/ssc/html/ssc/version/10459129902"
skills="https://fortify.fiserv.one/ssc/html/ssc/version/14654288708"
ui="https://fortify.fiserv.one/ssc/html/ssc/version/9403923396"

open $api
open $conversion
open $search
open $ui

open $extraction
open $admin
open $skills
open $aspt
