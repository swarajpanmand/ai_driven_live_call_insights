#!/bin/bash
# Package Lambda function
cd lambda
zip -r function.zip .
cd ..

# Update Lambda function code
aws lambda update-function-code \
    --function-name ai-driven-call-insights \
    --zip-file fileb://lambda/function.zip

# Deploy FastAPI app (optional, if not using Lambda)
docker build -t ai-call-insights .
docker run -p 8000:8000 ai-call-insights 