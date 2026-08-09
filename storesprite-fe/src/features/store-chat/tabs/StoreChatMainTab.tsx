import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  IconButton,
  Paper,
  Stack,
  Avatar,
  useTheme,
  Chip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import type { IChatMessage } from '../../../types/StoreChat.interface.js';

export default function StoreChatMainTab(): React.JSX.Element {
  const theme = useTheme();
  const [messages, setMessages] = useState<IChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Hello! I am Store Chat AI. How can I assist you with your UNAS product catalog, stock queries, or inventory today?',
      timestamp: 'Just now',
    },
  ]);
  const [inputValue, setInputValue] = useState<string>('');

  const handleSend = (): void => {
    if (!inputValue.trim()) return;

    const userMsg: IChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: inputValue.trim(),
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');

    // Sample automated response
    setTimeout(() => {
      const aiResponse: IChatMessage = {
        id: String(Date.now() + 1),
        sender: 'ai',
        text: `I received your query regarding "${userMsg.text}". In future iterations, I will query your live UNAS catalog and supplier database!`,
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 600);
  };

  return (
    <Box sx={{ maxWidth: 860 }}>
      <Card elevation={1} sx={{ borderRadius: '12px', overflow: 'hidden' }}>
        <Box
          sx={{
            p: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 36, height: 36 }}>
              <SmartToyOutlinedIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                Store Chat AI Assistant
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Online • Multi-tenant Catalog Intelligence
              </Typography>
            </Box>
          </Box>
          <Chip label="Ready" color="success" size="small" variant="outlined" />
        </Box>

        {/* Chat Message Stream */}
        <CardContent sx={{ minHeight: 320, maxHeight: 460, overflowY: 'auto', p: 2.5 }}>
          <Stack spacing={2}>
            {messages.map((msg) => (
              <Box
                key={msg.id}
                sx={{
                  display: 'flex',
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  gap: 1.5,
                }}
              >
                {msg.sender === 'ai' && (
                  <Avatar sx={{ width: 30, height: 30, bgcolor: theme.palette.primary.main }}>
                    <SmartToyOutlinedIcon sx={{ fontSize: 16 }} />
                  </Avatar>
                )}
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    maxWidth: '80%',
                    borderRadius: '10px',
                    bgcolor:
                      msg.sender === 'user'
                        ? theme.palette.primary.main
                        : theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(0, 0, 0, 0.04)',
                    color: msg.sender === 'user' ? '#FFFFFF' : 'text.primary',
                    border: `1px solid ${
                      msg.sender === 'user' ? theme.palette.primary.main : theme.palette.divider
                    }`,
                  }}
                >
                  <Typography variant="body2">{msg.text}</Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mt: 0.5,
                      fontSize: '0.675rem',
                      opacity: 0.8,
                      textAlign: msg.sender === 'user' ? 'right' : 'left',
                    }}
                  >
                    {msg.timestamp}
                  </Typography>
                </Paper>
                {msg.sender === 'user' && (
                  <Avatar sx={{ width: 30, height: 30, bgcolor: theme.palette.secondary.main }}>
                    <PersonOutlineIcon sx={{ fontSize: 16 }} />
                  </Avatar>
                )}
              </Box>
            ))}
          </Stack>
        </CardContent>

        {/* Input Bar */}
        <Box
          sx={{
            p: 1.5,
            borderTop: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            gap: 1,
          }}
        >
          <TextField
            placeholder="Ask anything about webshop stock, price anomalies, or catalog sync..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            fullWidth
            size="small"
          />
          <IconButton color="primary" onClick={handleSend} disabled={!inputValue.trim()}>
            <SendIcon />
          </IconButton>
        </Box>
      </Card>
    </Box>
  );
}
