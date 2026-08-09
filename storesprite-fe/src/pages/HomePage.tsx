import React from 'react';
import { Typography, Box } from '@mui/material';

export default function HomePage(): React.JSX.Element {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome to storesprite
      </Typography>
      <Typography variant="body1">
        This is the home page. Use the navigation on the left to explore the application.
      </Typography>
    </Box>
  );
}
