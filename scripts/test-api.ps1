#!/usr/bin/env pwsh

# Test script for custom OpenAI-compatible API endpoints
Write-Host "🧪 Testing Custom API Endpoint" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green

# Load environment variables
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
    Write-Host "✅ Loaded .env file" -ForegroundColor Green
} else {
    Write-Host "⚠️  No .env file found in current directory" -ForegroundColor Yellow
}

# Check required environment variables
$customApiKey = $env:CUSTOM_API_KEY
$customEndpoint = $env:CUSTOM_ENDPOINT
$customModel = $env:CUSTOM_MODEL

Write-Host ""
Write-Host "📋 Environment Variables:" -ForegroundColor Cyan
Write-Host "   CUSTOM_API_KEY: $(if ($customApiKey) { '✅ Set' } else { '❌ Missing' })" -ForegroundColor $(if ($customApiKey) { 'Green' } else { 'Red' })
Write-Host "   CUSTOM_ENDPOINT: $(if ($customEndpoint) { '✅ Set' } else { '❌ Missing' })" -ForegroundColor $(if ($customEndpoint) { 'Green' } else { 'Red' })
Write-Host "   CUSTOM_MODEL: $(if ($customModel) { '✅ Set' } else { '❌ Missing' })" -ForegroundColor $(if ($customModel) { 'Green' } else { 'Red' })

if (-not $customApiKey -or -not $customEndpoint -or -not $customModel) {
    Write-Host ""
    Write-Host "❌ Missing required environment variables!" -ForegroundColor Red
    Write-Host "Please set CUSTOM_API_KEY, CUSTOM_ENDPOINT, and CUSTOM_MODEL in your .env file" -ForegroundColor Red
    exit 1
}

# Ensure endpoint has correct format
if (-not $customEndpoint.EndsWith('/chat/completions')) {
    if ($customEndpoint.EndsWith('/')) {
        $customEndpoint = $customEndpoint + 'chat/completions'
    } elseif ($customEndpoint.EndsWith('/v1')) {
        $customEndpoint = $customEndpoint + '/chat/completions'
    } elseif ($customEndpoint.EndsWith('/v1/')) {
        $customEndpoint = $customEndpoint + 'chat/completions'
    } else {
        $customEndpoint = $customEndpoint + '/chat/completions'
    }
    Write-Host "   🔧 Corrected endpoint: $customEndpoint" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🚀 Testing API Connection..." -ForegroundColor Blue

# Test request
$testBody = @{
    model = $customModel
    messages = @(
        @{
            role = "system"
            content = "You are a helpful assistant."
        }
        @{
            role = "user"
            content = "Hello! Please respond with 'API test successful'"
        }
    )
    temperature = 0.7
    max_tokens = 100
    enable_thinking = $false
    stream = $false
} | ConvertTo-Json -Depth 10

$headers = @{
    "Authorization" = "Bearer $customApiKey"
    "Content-Type" = "application/json"
}

try {
    Write-Host "   📤 Sending test request..." -ForegroundColor Gray
    Write-Host "   🔗 Endpoint: $customEndpoint" -ForegroundColor Gray
    Write-Host "   🤖 Model: $customModel" -ForegroundColor Gray
    
    $response = Invoke-RestMethod -Uri $customEndpoint -Method Post -Body $testBody -Headers $headers -ContentType "application/json"
    
    Write-Host ""
    Write-Host "✅ API Test Successful!" -ForegroundColor Green
    Write-Host "   Response: $($response.choices[0].message.content)" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ API Test Failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        $statusDescription = $_.Exception.Response.StatusDescription
        Write-Host "   Status: $statusCode $statusDescription" -ForegroundColor Red
        
        try {
            $errorResponse = $_.ErrorDetails.Message
            if ($errorResponse) {
                Write-Host "   Details: $errorResponse" -ForegroundColor Red
            }
        } catch {
            Write-Host "   Could not read error details" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "🔧 Troubleshooting Tips:" -ForegroundColor Yellow
    Write-Host "   1. Check if your API key is valid" -ForegroundColor Gray
    Write-Host "   2. Verify the endpoint URL is correct" -ForegroundColor Gray
    Write-Host "   3. Ensure the model name is valid for your API" -ForegroundColor Gray
    Write-Host "   4. Check if your API service is running" -ForegroundColor Gray
}
