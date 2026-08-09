import React from 'react';
import { Typography, Box, Paper } from '@mui/material';

export default function SamplePage(): React.JSX.Element {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Sample Page
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1">
          This is a sample page. Content can be added here to demonstrate various UI components.
        </Typography>
      </Paper>
    </Box>
  );
}
