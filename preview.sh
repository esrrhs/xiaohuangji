#! /bin/bash

echo "" >preview.md

find ./data -type f -name '*' | while read FILE; do
  echo "![image]($FILE)" >>preview.md
done
