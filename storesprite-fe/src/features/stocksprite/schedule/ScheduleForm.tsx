import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import type { IMapping, IMappingSchedule } from '../../../types/Mapping.interface.js';
import type { IDataConnection } from '../../../types/DataConnection.interface.js';
import ConfirmDialog from '../../../components/ConfirmDialog.js';

type ScheduleFrequency = 'once' | 'daily' | 'monthly';

export interface ScheduleFormProps {
  initialMapping: IMapping | null;
  connections: IDataConnection[];
  mappings: IMapping[];
  onSave: (mappingId: string, payload: { scheduleEnabled: boolean; schedule: IMappingSchedule }) => Promise<void>;
  onDelete: (mappingId: string) => Promise<void>;
  onRun: (mappingId: string) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAYS: { value: number; key: string }[] = [
  { value: 1, key: 'mon' },
  { value: 2, key: 'tue' },
  { value: 3, key: 'wed' },
  { value: 4, key: 'thu' },
  { value: 5, key: 'fri' },
  { value: 6, key: 'sat' },
  { value: 0, key: 'sun' },
];

const formatHour = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

export default function ScheduleForm({
  initialMapping,
  connections,
  mappings,
  onSave,
  onDelete,
  onRun,
  onCancel,
  saving = false,
}: ScheduleFormProps): React.JSX.Element {
  const { t } = useAppTranslation();

  const isEditing = !!initialMapping?.id;

  const initialSchedule = initialMapping?.schedule ?? null;

  const [connectionId, setConnectionId] = useState<string>(initialMapping?.connectionId ?? '');
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean>(initialMapping?.scheduleEnabled ?? false);
  const [frequency, setFrequency] = useState<ScheduleFrequency>(initialSchedule?.frequency ?? 'daily');
  const [onceDate, setOnceDate] = useState<string>(initialSchedule?.frequency === 'once' ? initialSchedule.date : '');
  const [onceTime, setOnceTime] = useState<number>(initialSchedule?.frequency === 'once' ? initialSchedule.time : 9);
  const [dailyTimes, setDailyTimes] = useState<number[]>(initialSchedule?.frequency === 'daily' ? initialSchedule.times : [9]);
  const [dailyDaysOfWeek, setDailyDaysOfWeek] = useState<number[]>(
    initialSchedule?.frequency === 'daily' && initialSchedule.daysOfWeek ? initialSchedule.daysOfWeek : []
  );
  const [monthlyDayOfMonth, setMonthlyDayOfMonth] = useState<number>(
    initialSchedule?.frequency === 'monthly' ? initialSchedule.dayOfMonth : 1
  );
  const [monthlyTime, setMonthlyTime] = useState<number>(initialSchedule?.frequency === 'monthly' ? initialSchedule.time : 9);
  const [saved, setSaved] = useState<boolean>(isEditing);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);

  const addableConnections = useMemo(
    () =>
      connections.filter((c) => {
        const mapping = mappings.find((m) => m.connectionId === c.id);
        return (
          c.testResult?.success === true &&
          (c.testResult.columns?.length ?? 0) > 0 &&
          !!mapping &&
          mapping.schedule == null
        );
      }),
    [connections, mappings]
  );

  const mappingId = useMemo(() => {
    if (isEditing) {
      return initialMapping?.id ?? null;
    }
    return mappings.find((m) => m.connectionId === connectionId)?.id ?? null;
  }, [isEditing, initialMapping, mappings, connectionId]);

  const connectionName = isEditing
    ? connections.find((c) => c.id === initialMapping?.connectionId)?.name ?? initialMapping?.connectionId ?? ''
    : connections.find((c) => c.id === connectionId)?.name ?? '';

  const buildSchedule = (): IMappingSchedule => {
    switch (frequency) {
      case 'once':
        return { frequency: 'once', date: onceDate, time: onceTime };
      case 'daily':
        return dailyDaysOfWeek.length > 0
          ? { frequency: 'daily', times: dailyTimes, daysOfWeek: dailyDaysOfWeek }
          : { frequency: 'daily', times: dailyTimes };
      case 'monthly':
        return { frequency: 'monthly', dayOfMonth: monthlyDayOfMonth, time: monthlyTime };
    }
  };

  const scheduleInvalid = scheduleEnabled && frequency === 'once' && !onceDate;
  const canSave = !!mappingId && !scheduleInvalid && !saving;

  const handleSave = async (): Promise<void> => {
    if (!mappingId) return;
    try {
      await onSave(mappingId, { scheduleEnabled, schedule: buildSchedule() });
      setSaved(true);
    } catch {
      // parent shows the error toast
    }
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    setDeleteModalOpen(false);
    if (mappingId) {
      try {
        await onDelete(mappingId);
      } catch {
        // parent shows the error toast
      }
    }
  };

  const handleRun = async (): Promise<void> => {
    if (!mappingId) return;
    try {
      await onRun(mappingId);
    } catch {
      // parent shows the error toast
    }
  };

  const toggleDay = (day: number): void => {
    setSaved(false);
    setDailyDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const applyWeekdays = (): void => {
    setSaved(false);
    setDailyDaysOfWeek([1, 2, 3, 4, 5]);
  };

  const addHour = (): void => {
    setSaved(false);
    setDailyTimes((prev) => {
      const last = prev[prev.length - 1] ?? 8;
      return [...prev, (last + 1) % 24];
    });
  };

  const removeHour = (index: number): void => {
    setSaved(false);
    setDailyTimes((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onCancel} sx={{ textTransform: 'none' }}>
          {t('stocksprite.schedule.backToList')}
        </Button>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {isEditing ? t('stocksprite.schedule.editTitle') : t('stocksprite.schedule.addTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('stocksprite.schedule.subtitle')}
          </Typography>
        </Box>
      </Box>

      <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          {isEditing ? (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                {t('stocksprite.schedule.connection')}
              </Typography>
              <Typography variant="body1">{connectionName}</Typography>
            </Box>
          ) : (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="schedule-connection-label">{t('stocksprite.schedule.connection')}</InputLabel>
              <Select
                labelId="schedule-connection-label"
                label={t('stocksprite.schedule.connection')}
                value={connectionId}
                onChange={(e) => {
                  setSaved(false);
                  setConnectionId(e.target.value);
                }}
              >
                {addableConnections.length === 0 && (
                  <MenuItem value="" disabled>
                    {t('stocksprite.schedule.noAvailableConnections')}
                  </MenuItem>
                )}
                {addableConnections.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {!!mappingId && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {t('stocksprite.schedule.enable')}
                </Typography>
                <Switch
                  checked={scheduleEnabled}
                  onChange={(e) => {
                    setSaved(false);
                    setScheduleEnabled(e.target.checked);
                  }}
                />
              </Box>

              <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                  {t('stocksprite.schedule.frequency')}
                </Typography>
                <RadioGroup
                  row
                  value={frequency}
                  onChange={(e) => {
                    setSaved(false);
                    setFrequency(e.target.value as ScheduleFrequency);
                  }}
                >
                  <FormControlLabel value="once" control={<Radio />} label={t('stocksprite.schedule.once')} />
                  <FormControlLabel value="daily" control={<Radio />} label={t('stocksprite.schedule.daily')} />
                  <FormControlLabel value="monthly" control={<Radio />} label={t('stocksprite.schedule.monthly')} />
                </RadioGroup>
              </FormControl>

              {frequency === 'once' && (
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <TextField
                    label={t('stocksprite.schedule.date')}
                    type="date"
                    value={onceDate}
                    onChange={(e) => {
                      setSaved(false);
                      setOnceDate(e.target.value);
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 200 }}
                  />
                  <FormControl sx={{ minWidth: 140 }}>
                    <InputLabel id="once-time-label">{t('stocksprite.schedule.time')}</InputLabel>
                    <Select
                      labelId="once-time-label"
                      label={t('stocksprite.schedule.time')}
                      value={onceTime}
                      onChange={(e) => {
                        setSaved(false);
                        setOnceTime(Number(e.target.value));
                      }}
                    >
                      {HOURS.map((h) => (
                        <MenuItem key={h} value={h}>
                          {formatHour(h)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}

              {frequency === 'daily' && (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                    {t('stocksprite.schedule.hours')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
                    {dailyTimes.map((hour, index) => (
                      <FormControl key={index} sx={{ minWidth: 120 }}>
                        <Select
                          value={hour}
                          onChange={(e) => {
                            setSaved(false);
                            setDailyTimes((prev) => prev.map((h, i) => (i === index ? Number(e.target.value) : h)));
                          }}
                        >
                          {HOURS.map((h) => (
                            <MenuItem key={h} value={h}>
                              {formatHour(h)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ))}
                    <Button size="small" onClick={addHour} sx={{ textTransform: 'none' }}>
                      {t('stocksprite.schedule.addHour')}
                    </Button>
                    {dailyTimes.length > 1 && (
                      <Button size="small" color="error" onClick={() => removeHour(dailyTimes.length - 1)} sx={{ textTransform: 'none' }}>
                        {t('stocksprite.schedule.removeHour')}
                      </Button>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {t('stocksprite.schedule.daysOfWeek')}
                    </Typography>
                    <Button size="small" variant="outlined" onClick={applyWeekdays} sx={{ textTransform: 'none' }}>
                      {t('stocksprite.schedule.weekdays')}
                    </Button>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                    {WEEKDAYS.map((day) => (
                      <FormControlLabel
                        key={day.value}
                        control={
                          <Checkbox
                            size="small"
                            checked={dailyDaysOfWeek.includes(day.value)}
                            onChange={() => toggleDay(day.value)}
                          />
                        }
                        label={t(`stocksprite.schedule.days.${day.key}`)}
                      />
                    ))}
                  </Box>
                  {dailyDaysOfWeek.length === 0 && (
                    <FormHelperText>{t('stocksprite.schedule.daysOfWeekHelper')}</FormHelperText>
                  )}
                </Box>
              )}

              {frequency === 'monthly' && (
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <FormControl sx={{ minWidth: 160 }}>
                    <InputLabel id="monthly-day-label">{t('stocksprite.schedule.dayOfMonth')}</InputLabel>
                    <Select
                      labelId="monthly-day-label"
                      label={t('stocksprite.schedule.dayOfMonth')}
                      value={monthlyDayOfMonth}
                      onChange={(e) => {
                        setSaved(false);
                        setMonthlyDayOfMonth(Number(e.target.value));
                      }}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <MenuItem key={d} value={d}>
                          {d}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl sx={{ minWidth: 140 }}>
                    <InputLabel id="monthly-time-label">{t('stocksprite.schedule.time')}</InputLabel>
                    <Select
                      labelId="monthly-time-label"
                      label={t('stocksprite.schedule.time')}
                      value={monthlyTime}
                      onChange={(e) => {
                        setSaved(false);
                        setMonthlyTime(Number(e.target.value));
                      }}
                    >
                      {HOURS.map((h) => (
                        <MenuItem key={h} value={h}>
                          {formatHour(h)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Box>
          <Button
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteModalOpen(true)}
            disabled={!mappingId || saving}
            sx={{ textTransform: 'none' }}
          >
            {t('stocksprite.schedule.deleteSchedule')}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<PlayArrowIcon />}
            onClick={() => void handleRun()}
            disabled={!saved || !mappingId || saving}
            sx={{ textTransform: 'none' }}
          >
            {t('stocksprite.schedule.runNow')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={() => void handleSave()}
            disabled={!canSave}
            sx={{ textTransform: 'none', borderRadius: 2, px: 3 }}
          >
            {saving ? t('common.saving') : t('stocksprite.schedule.save')}
          </Button>
        </Box>
      </Box>

      <ConfirmDialog
        open={deleteModalOpen}
        title={t('stocksprite.schedule.deleteModal.title')}
        description={t('stocksprite.schedule.deleteModal.prompt')}
        confirmLabel={t('stocksprite.schedule.deleteModal.yes')}
        cancelLabel={t('stocksprite.schedule.deleteModal.no')}
        destructive
        onConfirm={() => void handleDeleteConfirm()}
        onClose={() => setDeleteModalOpen(false)}
      />
    </Box>
  );
}
