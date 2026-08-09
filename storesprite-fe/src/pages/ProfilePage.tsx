import React from 'react';
import {
  Typography,
  Box,
  Paper,
  Button,
  Stack,
  Divider,
} from '@mui/material';
import { useClerk } from '@clerk/clerk-react';

interface ProfileField {
  label: string;
  value: string;
}

const DUMMY_PROFILE: ProfileField[] = [
  { label: 'Username', value: 'john.doe' },
  { label: 'Email', value: 'john.doe@example.com' },
  { label: 'Registration Date', value: '2024-01-15' },
];

export default function ProfilePage(): React.JSX.Element {
  const { signOut } = useClerk();

  const handleLogout = (): void => {
    void signOut();
  };

  const handleDeleteProfile = (): void => {
    // Placeholder for delete profile action
    alert('Delete profile action triggered.');
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        User Profile
      </Typography>
      <Paper sx={{ p: 3, maxWidth: 480 }}>
        <Stack spacing={2}>
          {DUMMY_PROFILE.map((field) => (
            <Box key={field.label}>
              <Typography variant="caption" color="text.secondary">
                {field.label}
              </Typography>
              <Typography variant="body1">{field.value}</Typography>
            </Box>
          ))}
          <Divider />
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" color="error" onClick={handleDeleteProfile}>
              Delete Profile
            </Button>
            <Button variant="contained" onClick={handleLogout}>
              Logout
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
