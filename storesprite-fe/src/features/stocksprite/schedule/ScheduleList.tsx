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
import ScheduleIcon from '@mui/icons-material/Schedule';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import type { IMapping } from '../../../types/Mapping.interface.js';

export interface ScheduleListProps {
  schedules: IMapping[];
  onAddNew: () => void;
  onSelectMapping: (mapping: IMapping) => void;
}

export default function ScheduleList({
  schedules,
  onAddNew,
  onSelectMapping,
}: ScheduleListProps): React.JSX.Element {
  const { t } = useAppTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleIcon color="primary" />
            {t('stocksprite.schedule.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('stocksprite.schedule.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={onAddNew}
          sx={{ textTransform: 'none', fontWeight: 600, px: 3, py: 1, borderRadius: 2 }}
        >
          {t('stocksprite.schedule.addSchedule')}
        </Button>
      </Box>

      {schedules.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 2, textAlign: 'center', py: 6, bgcolor: 'background.paper' }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <ScheduleIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography variant="h6" color="text.secondary">
              {t('stocksprite.schedule.empty')}
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={onAddNew} sx={{ textTransform: 'none', mt: 1 }}>
              {t('stocksprite.schedule.addSchedule')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600 }}>{t('stocksprite.schedule.name')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('stocksprite.schedule.enabled')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.map((mapping) => (
                <TableRow
                  key={mapping.id}
                  hover
                  onClick={() => onSelectMapping(mapping)}
                  sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {mapping.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={mapping.scheduleEnabled ? 'success' : 'default'}
                      label={mapping.scheduleEnabled ? t('common.enabled') : t('common.disabled')}
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
