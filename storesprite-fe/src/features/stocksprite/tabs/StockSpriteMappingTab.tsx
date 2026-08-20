import React from 'react';
import { Box, Typography, Card, CardContent, Alert } from '@mui/material';

export default function StockSpriteMappingTab(): React.JSX.Element {
  return (
    <Box sx={{ maxWidth: 800 }}>
      <Card elevation={1}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            CSV Column & Product Mapping
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Map external supplier CSV inventory headers (e.g. SKU, Barcode, Warehouse Stock, Net Price) to UNAS product fields.
          </Typography>

          <Alert severity="info" sx={{ borderRadius: '8px' }}>
            Configure dynamic column mapping profiles for Cromwell, Dunitker, and custom suppliers.
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
}
