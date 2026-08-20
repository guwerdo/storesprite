import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CableIcon from '@mui/icons-material/Cable';
import LanguageIcon from '@mui/icons-material/Language';
import StorageIcon from '@mui/icons-material/Storage';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import type { IDataConnection } from '../../../types/DataConnection.interface.js';

export interface ConnectionListProps {
  connections: IDataConnection[];
  onAddNew: () => void;
  onSelectConnection: (connection: IDataConnection) => void;
}

export default function ConnectionList({
  connections,
  onAddNew,
  onSelectConnection,
}: ConnectionListProps): React.JSX.Element {
  const { t } = useAppTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Top Action Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CableIcon color="primary" />
            {t('stocksprite.tabs.connections')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('stocksprite.connections.form.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={onAddNew}
          sx={{ textTransform: 'none', fontWeight: 600, px: 3, py: 1, borderRadius: 2 }}
        >
          {t('stocksprite.connections.addNew')}
        </Button>
      </Box>

      {/* Connections Table or Empty State */}
      {connections.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 2, textAlign: 'center', py: 6, bgcolor: 'background.paper' }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CableIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography variant="h6" color="text.secondary">
              {t('stocksprite.connections.empty')}
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={onAddNew} sx={{ textTransform: 'none', mt: 1 }}>
              {t('stocksprite.connections.addNew')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600 }}>{t('stocksprite.connections.table.name')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('stocksprite.connections.table.channel')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('stocksprite.connections.table.format')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('stocksprite.connections.table.status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {connections.map((conn) => (
                <TableRow
                  key={conn.id}
                  hover
                  onClick={() => onSelectConnection(conn)}
                  sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {conn.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      icon={conn.channel === 'HTTP' ? <LanguageIcon fontSize="small" /> : <StorageIcon fontSize="small" />}
                      label={conn.channel}
                      color={conn.channel === 'HTTP' ? 'info' : 'secondary'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={conn.dataFormat}
                      color={conn.dataFormat === 'CSV' ? 'success' : 'warning'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={conn.isActive ? t('common.active') : t('common.inactive')}
                      color={conn.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
