## How to run app with test data on Unas webshop
- Add test products to unas using by generating a test product xml using the `doc\unas-test-product-creator\update-test-id-updater.ps1` script and uploading the test data with the created product ids using the `setProduct - add` Postman request.
- Update the test data in `app\src\test\data\cromwell-test-data.csv` with the generated product ids. If you update it you need to rebuild the application with `npm run build` so test data file gets updated in the `dist folder`. Or update test data directly in the `app\dist\test\data\cromwell-test-data.csv` file.
- In file `/app/src/inversify.config.ts` 
	- Set the `MOCK_DATA_PROVIDER` variable value to `true`.
	- Set the `MOCK_UNAS_CLIENT` variable value to `false`.
- Run `npm run cache:rel` to download and cache the test data from unas.
- Run `npm run pub:rel` to publish the test data from the `cromwell-test-data.csv` file.
- Run `npm run sub:rel` to consume the publised data and update the changes from the test data on the unad webshop.
