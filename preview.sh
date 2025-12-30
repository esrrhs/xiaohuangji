#! /bin/bash

echo "" >preview.md

find ./data -type f -name '*' | while read FILE; do
  echo -n "<img src=\"$FILE\" width=\"200\" /> " >> preview.md
done
