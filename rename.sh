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

find ./data -type f -name '*' | while read FILE; do
  md5=$(md5sum "${FILE}" | awk '{print $1}')
  ext="$(echo ${FILE} | grep -o "\.[a-zA-Z]*$")"
  for name in $(ls -l ./data | grep $md5 | awk '{print $9}'); do
    other_ext="$(echo ${name} | grep -o "\.[a-zA-Z]*$")"
    if [ "$ext" != "$other_ext" ]; then
      echo "dumplicate "${FILE}
      rm -f ${FILE}
    fi
  done
done
