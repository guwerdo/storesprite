import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  IconButton,
  Grid2 as Grid,
  Chip,
  Stack,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

export default function SearchSpriteMainTab(): React.JSX.Element {
  const [searchTerm, setSearchTerm] = useState<string>('');

  const sampleResults = [
    {
      sku: 'DUN-98214',
      name: 'Industrial Torque Wrench 1/2" Drive 40-200Nm',
      category: 'Hand Tools / Wrenches',
      stock: 42,
      price: '28,500 HUF',
      supplier: 'Dunitker',
    },
    {
      sku: 'CRM-40112',
      name: 'High Performance Cobalt Drill Bit Set 19-pc',
      category: 'Cutting Tools / Drills',
      stock: 128,
      price: '14,200 HUF',
      supplier: 'Cromwell',
    },
    {
      sku: 'DUN-11045',
      name: 'Pneumatic Impact Wrench 3/4" Composite Body',
      category: 'Pneumatic Tools',
      stock: 7,
      price: '74,900 HUF',
      supplier: 'Dunitker',
    },
  ];

  return (
    <Box>
      {/* Search Header */}
      <Card elevation={1} sx={{ p: 2.5, mb: 3 }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={700}>
              Semantic Catalog Search Engine
            </Typography>
          </Box>
          <TextField
            placeholder="Search by SKU, supplier product name, category, or natural language query..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="filters">
                    <FilterListIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              Suggestions:
            </Typography>
            {['Torque Wrench', 'Cobalt Drills', 'Low Stock < 10', 'Dunitker Feeds'].map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant="outlined"
                onClick={() => setSearchTerm(tag)}
                sx={{ borderRadius: '6px', fontSize: '0.75rem' }}
              />
            ))}
          </Stack>
        </Stack>
      </Card>

      {/* Catalog Search Results Grid */}
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Indexed Products (Preview)
      </Typography>
      <Grid container spacing={2}>
        {sampleResults.map((item) => (
          <Grid size={{ xs: 12, md: 4 }} key={item.sku}>
            <Card elevation={1} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Chip
                    label={item.supplier}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ borderRadius: '4px', height: 22, fontSize: '0.7rem' }}
                  />
                  <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                    SKU: {item.sku}
                  </Typography>
                </Stack>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  {item.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {item.category}
                </Typography>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={600}>
                    Stock: {item.stock} pcs
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                    {item.price}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
