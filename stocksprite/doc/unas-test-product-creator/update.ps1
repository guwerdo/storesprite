$SKUs = @(
    "teszt2f-cw-00001",
    "teszt2f-cw-00002",
    "teszt2f-cw-00003",
    "teszt2f-cw-00004",
    "teszt2f-cw-00005",
    "teszt2f-cw-00006",
    "teszt2f-cw-00007",
    "teszt2f-cw-00008",
    "teszt2f-cw-00009",
    "teszt2f-cw-00010",
    "teszt2f-cw-00011",
    "teszt2f-cw-00012",
    "teszt2f-cw-00013",
    "teszt2f-mt-00001",
    "teszt2f-mt-00002",
    "teszt2f-mt-00003",
    "teszt2f-mt-00004",
    "teszt2f-mt-00005",
    "teszt2f-mt-00006",
    "teszt2f-mt-00007",
    "teszt2f-mt-00008",
    "teszt2f-mt-00009",
    "teszt2f-mt-00010",
    "teszt2f-mt-00011",
    "teszt2f-mt-00012",
    "teszt2f-mt-00013"
)

$productTemplatePath = "unas-product-template.tpl"
if (-not (Test-Path $productTemplatePath)) {
    Write-Error "File '$productTemplatePath' not found."
    exit 1
}
$productTemplate = Get-Content $productTemplatePath -Raw

# loop sku array and create a new product from the template for each sku by replacing the '{sku}' string in the template
$products = foreach ($s in $SKUs) {
    $product = $productTemplate -replace "\{sku\}", $s
    $product
}

$result = "<?xml version=""1.0"" encoding=""UTF-8"" ?>
<Products>`n" + ($products -join "`n") + "`n</Products>"

$outputFile = "result.xml"
Set-Content -Path $outputFile -Value $result -Encoding UTF8
Write-Output "File $outputFile generated successfully."
