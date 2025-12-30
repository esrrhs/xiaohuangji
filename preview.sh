#! /bin/bash

cp README.template README.md

find ./data -type f -name '*' | while read FILE; do
  echo -n "<img src=\"$FILE\" width=\"100\" /> " >> README.md
done
