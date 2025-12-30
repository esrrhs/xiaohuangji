#! /bin/bash

echo "" >preview.md

find ./data -type f -name '*' | while read FILE; do
  echo "<img src=\"$FILE\" width=\"300\" />" >> preview.md
done
