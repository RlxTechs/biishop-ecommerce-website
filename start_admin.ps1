$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (!(Test-Path ".venv")) { python -m venv .venv }
. .\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
if (-not $env:BI_SHOP_ADMIN_PASSWORD) { $env:BI_SHOP_ADMIN_PASSWORD = "admin123" }
if (-not $env:BI_SHOP_SECRET_KEY) { $env:BI_SHOP_SECRET_KEY = "bi-shop-local-secret-change-me" }
python app.py
