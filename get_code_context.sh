#!/bin/bash

# Generic code context gatherer
# Put this in your root folder of your project
# Run the command chmod +x get_code_context.sh
# Then run ./get_code_context.sh

# Use the current directory as the project directory
project_dir=$(pwd)

# Use a fixed name for the output file in the current directory
output_file="${project_dir}/code_context.txt"

# Check if the output file exists and remove it if it does
if [ -f "$output_file" ]; then
  rm "$output_file"
fi

# List of file extensions to include
include_extensions=("js" "jsx" "ts" "tsx" "css" "scss" "html" "py" "rb" "php" "json" "md" "sh" "yml" "yaml" "txt" "env" "config" "conf")

# List of specific important files to always include (regardless of extension)
important_files=("package.json" "package-lock.json" "requirements.txt" "Dockerfile" "README.md" "deploy.sh" "server.js" "index.html" "vite.config.js" "lambda_function.py")

# List of file types to ignore
ignore_files=("*.ico" "*.png" "*.jpg" "*.jpeg" "*.gif" "*.svg" "*.min.js" "*.min.css" "*.log" "*.tmp")

# List of directories to exclude (but keep meet-transcriber)
exclude_dirs=("node_modules" ".git" "build" "dist" "__pycache__" ".venv" "venv" ".env")

# Recursive function to read files and append their content
read_files() {
  for entry in "$1"/*
  do
    # Check if the directory should be excluded
    local base_name=$(basename "$entry")
    if [[ " ${exclude_dirs[@]} " =~ " ${base_name} " ]]; then
      continue
    fi

    if [ -d "$entry" ]; then
      # If entry is a directory, call this function recursively
      read_files "$entry"
    elif [ -f "$entry" ]; then
      # Get the file extension
      extension="${entry##*.}"
      filename=$(basename "$entry")
      
      # Check if this is an important file that should always be included
      is_important=false
      for important_file in "${important_files[@]}"; do
        if [[ "$filename" == "$important_file" ]]; then
          is_important=true
          break
        fi
      done

      # Check if the file extension should be included
      should_include=false
      for include_ext in "${include_extensions[@]}"; do
        if [[ "$extension" == "$include_ext" ]]; then
          should_include=true
          break
        fi
      done

      # Check if the file type should be ignored
      should_ignore=false
      for ignore_pattern in "${ignore_files[@]}"; do
        if [[ "$entry" == *"$ignore_pattern" ]]; then
          should_ignore=true
          break
        fi
      done

      # If the file should be included (either by extension or importance) and not ignored, append its relative path and content to the output file
      if ($should_include || $is_important) && ! $should_ignore; then
        relative_path=${entry#"$project_dir/"}
        echo "// File: $relative_path" >> "$output_file"
        cat "$entry" >> "$output_file"
        echo "" >> "$output_file"
      fi
    fi
  done
}

# Call the recursive function starting from the project directory
read_files "$project_dir"

echo "Code context has been saved to $output_file"