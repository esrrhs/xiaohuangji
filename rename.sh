#! /bin/bash

find ./data -type f -name '*' | while read FILE; do
  md5=$(md5sum "${FILE}" | awk '{print $1}')
  ext="$(echo ${FILE} | grep -o "\.[a-zA-Z]*$")"
  newfile="./data/${md5}${ext}"
  if [ "$FILE" != "$newfile" ]; then
    mv "${FILE}" "./data/${md5}${ext}"
  fi
  echo "done "${FILE}
done

declare -A seen_md5
while IFS= read -r FILE; do
  basename="${FILE##*/}"
  md5="${basename%.*}"
  if [ -n "${seen_md5[$md5]}" ]; then
    echo "duplicate $FILE"
    rm -f "$FILE"
  else
    seen_md5[$md5]=1
  fi
done < <(find ./data -type f -name '*')
