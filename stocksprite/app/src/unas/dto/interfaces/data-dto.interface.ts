export interface IDataDto {
    id: number | undefined; // The id of the data field on Unas. Users can add 3 data fields from id 1-3 on the web admin page: https://shop.unas.hu/admin_config_product_data.php
    value: string | undefined;
}
