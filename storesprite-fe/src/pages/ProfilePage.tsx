import React from 'react';
import {
  Typography,
  Box,
  Paper,
  Button,
  Stack,
  Divider,
  Avatar,
} from '@mui/material';
import { useClerk, useUser } from '@clerk/clerk-react';

export default function ProfilePage(): React.JSX.Element {
  const { signOut } = useClerk();
  const { user } = useUser();

  const handleLogout = (): void => {
    void signOut();
  };

  const handleDeleteProfile = (): void => {
    if (user) {
      if (window.confirm('Are you sure you want to delete your user account?')) {
        user.delete().catch((err: unknown) => console.error(err));
      }
    }
  };

  const profileFields = [
    { label: 'Full Name', value: user?.fullName || 'N/A' },
    { label: 'Username', value: user?.username || 'N/A' },
    { label: 'Primary Email', value: user?.primaryEmailAddress?.emailAddress || 'N/A' },
    { label: 'User ID', value: user?.id || 'N/A' },
    {
      label: 'Registration Date',
      value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A',
    },
    {
      label: 'Last Sign In',
      value: user?.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : 'N/A',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        User Profile
      </Typography>
      <Paper sx={{ p: 3, maxWidth: 520 }}>
        <Stack spacing={3}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              src={user?.imageUrl}
              alt={user?.fullName || 'User Avatar'}
              sx={{ width: 64, height: 64 }}
            />
            <Box>
              <Typography variant="h6">{user?.fullName || user?.username || 'User'}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.primaryEmailAddress?.emailAddress}
              </Typography>
            </Box>
          </Stack>

          <Divider />

          {profileFields.map((field) => (
            <Box key={field.label}>
              <Typography variant="caption" color="text.secondary">
                {field.label}
              </Typography>
              <Typography variant="body1">{field.value}</Typography>
            </Box>
          ))}

          <Divider />

          <Stack direction="row" spacing={2} justifyContent="flex-end">
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
